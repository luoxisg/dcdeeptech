from __future__ import annotations

from uuid import uuid4
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from ...db.session import get_db
from ...schemas.models import LeadDetailModel, PaginatedLeadsModel, SearchFiltersModel, SearchRequestModel
from ...services.serializers import build_lead_card, build_lead_detail
from packages.db.models import Company, CompanySignal, Search
from packages.scoring.service import score_company

router = APIRouter()


def _query_companies(db: Session):
    return db.query(Company).options(
        selectinload(Company.signals).selectinload(CompanySignal.reviews),
        selectinload(Company.funding_events),
        selectinload(Company.scores),
        selectinload(Company.watchlists),
    )


def _apply_filters(queryset, filters: SearchFiltersModel):
    if filters.industry:
        queryset = queryset.filter(Company.industry_primary.ilike(f"%{filters.industry}%"))
    if filters.geography:
        queryset = queryset.filter(Company.hq_country.ilike(f"%{filters.geography}%"))
    if filters.english_website is not None:
        queryset = queryset.filter(Company.english_site == filters.english_website)
    if filters.recent_activity_window_days:
        queryset = queryset.filter(Company.last_seen_at >= datetime.utcnow() - timedelta(days=filters.recent_activity_window_days))
    return queryset


def _shape_results(companies, filters: SearchFiltersModel):
    items = [build_lead_card(company) for company in companies]
    if filters.agent_type:
        items = [item for item in items if item["primary_score"]["agent_type"] == filters.agent_type]
    if filters.minimum_score:
        items = [item for item in items if item["primary_score"]["fit_score"] >= filters.minimum_score]
    if filters.multi_country_operations is True:
        items = [item for item in items if len(item["company"]["operating_regions"]) >= 3]
    if filters.overseas_factory is True:
        items = [
            item
            for item in items
            if any("factory" in (signal["raw_metadata"].get("flags", [])) or "vietnam" in (signal["raw_metadata"].get("flags", [])) for signal in ([item["latest_signal"]] if item["latest_signal"] else []))
            or item["primary_score"]["agent_type"] == "heavy_asset_global"
        ]
    if filters.offshore_structure_hint is True:
        items = [
            item
            for item in items
            if item["primary_score"]["agent_type"] == "vie_usd" or item["secondary_score"] and item["secondary_score"]["agent_type"] == "vie_usd"
        ]
    if filters.funding_stage:
        items = [item for item in items if filters.funding_stage.lower() in item["company"]["description"].lower() or filters.funding_stage.lower() in item["opening_angle_summary"].lower()]

    reverse = filters.sort_order != "asc"
    if filters.sort_by == "confidence_score":
        items = sorted(items, key=lambda item: item["primary_score"]["confidence_score"], reverse=reverse)
    elif filters.sort_by == "last_seen_at":
        items = sorted(items, key=lambda item: item["company"]["last_seen_at"], reverse=reverse)
    else:
        items = sorted(items, key=lambda item: item["primary_score"]["fit_score"], reverse=reverse)
    return items


@router.post("/search", response_model=PaginatedLeadsModel)
def create_search(payload: SearchRequestModel, db: Session = Depends(get_db)):
    filters = payload.filters
    items = _shape_results(_apply_filters(_query_companies(db), filters).all(), filters)
    db.add(
        Search(
            search_id=str(uuid4()),
            user_query_name=payload.user_query_name,
            filters_json=payload.filters.model_dump(),
            result_count=len(items),
        )
    )
    db.commit()
    start = (filters.page - 1) * filters.page_size
    end = start + filters.page_size
    return {
        "items": items[start:end],
        "total": len(items),
        "page": filters.page,
        "page_size": filters.page_size,
        "sort_by": filters.sort_by,
        "sort_order": filters.sort_order,
    }


@router.get("/leads", response_model=PaginatedLeadsModel)
def list_leads(
    agent_type: str | None = None,
    industry: str | None = None,
    geography: str | None = None,
    recent_activity_window_days: int | None = None,
    funding_stage: str | None = None,
    english_website: bool | None = None,
    offshore_structure_hint: bool | None = None,
    multi_country_operations: bool | None = None,
    overseas_factory: bool | None = None,
    minimum_score: int = 0,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = Query(default="fit_score"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
):
    filters = SearchFiltersModel(
        agent_type=agent_type,
        industry=industry,
        geography=geography,
        recent_activity_window_days=recent_activity_window_days,
        funding_stage=funding_stage,
        english_website=english_website,
        offshore_structure_hint=offshore_structure_hint,
        multi_country_operations=multi_country_operations,
        overseas_factory=overseas_factory,
        minimum_score=minimum_score,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    items = _shape_results(_apply_filters(_query_companies(db), filters).all(), filters)
    start = (page - 1) * page_size
    end = start + page_size
    return {"items": items[start:end], "total": len(items), "page": page, "page_size": page_size, "sort_by": sort_by, "sort_order": sort_order}


@router.get("/leads/{company_id}", response_model=LeadDetailModel)
def get_lead(company_id: str, db: Session = Depends(get_db)):
    company = _query_companies(db).filter(Company.company_id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Lead not found")
    return build_lead_detail(company)


@router.post("/leads/{company_id}/rescore", response_model=LeadDetailModel)
def rescore_lead(company_id: str, db: Session = Depends(get_db)):
    company = _query_companies(db).filter(Company.company_id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Lead not found")
    refreshed = score_company(
        {
            "company_name_en": company.company_name_en,
            "industry_primary": company.industry_primary,
            "company_type": company.company_type,
            "english_site": company.english_site,
            "source_count": company.source_count,
            "operating_regions": company.operating_regions,
        },
        [{"raw_metadata": signal.raw_metadata, "confidence": signal.confidence} for signal in company.signals],
        [{"currency_hint": event.currency_hint, "international_investor_flag": event.international_investor_flag, "offshore_entity_hint": event.offshore_entity_hint} for event in company.funding_events],
    )
    existing = {item.agent_type: item for item in company.scores}
    hybrid = "hybrid" if refreshed[1].fit_score >= 70 else None
    for result in refreshed:
        score = existing[result.agent_type.value]
        score.fit_score = result.fit_score
        score.confidence_score = result.confidence_score
        score.priority_tier = result.priority_tier.value
        score.reasons = result.reasons
        score.recommended_roles = result.recommended_roles
        score.opening_angle = result.opening_angle
        score.next_action = result.next_action
        score.likely_needs = result.likely_needs
        score.hybrid_tag = hybrid
    db.commit()
    db.refresh(company)
    return build_lead_detail(company)
