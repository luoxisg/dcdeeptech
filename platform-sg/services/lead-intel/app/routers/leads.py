"""Lead intelligence API routes."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.repository import export_rows, fetch_lead, fetch_leads
from app.schemas import DiscoveryRequest, DiscoveryResponse, ExportResponse, LeadCard, LeadSearchResponse, QualificationResponse

router = APIRouter(prefix="/lead-intel", tags=["lead-intel"])


@router.get("/companies", response_model=LeadSearchResponse)
async def list_companies(
    search: str = "",
    region: str | None = None,
    min_score: int = 0,
    stage: str | None = None,
    usd_backed_only: bool = False,
    international_backing_only: bool = False,
):
    items = fetch_leads(
        search=search,
        region=region,
        min_score=min_score,
        stage=stage,
        usd_backed_only=usd_backed_only,
        international_backing_only=international_backing_only,
    )
    return {"total": len(items), "items": items}


@router.get("/companies/{company_id}", response_model=LeadCard)
async def get_company(company_id: str):
    lead = fetch_lead(company_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("/discovery/search", response_model=DiscoveryResponse)
async def discovery_search(payload: DiscoveryRequest):
    items = fetch_leads(search=payload.query, region=payload.region_focus, min_score=payload.min_score)
    return {
        "query": payload.query,
        "candidates_found": len(items),
        "shortlisted": items[:5],
        "connector_notes": [
            "Connector searched normalized names, funding summaries, and profile text for China-linked firms with international expansion signals.",
            "Qualification prioritizes USD-funded or internationally backed companies with probable AI infra and compliance complexity.",
            "v1 keeps human review and exportable lead cards at the center of the workflow and excludes auto-email sending.",
        ],
    }


@router.post("/qualify/{company_id}", response_model=QualificationResponse)
async def qualify_company(company_id: str):
    lead = fetch_lead(company_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    score = lead["lead_score"]
    return {
        "company_id": company_id,
        "status": "qualified" if score["final_lead_score"] >= 75 else "watchlist",
        "company_profile": lead["company_profile"],
        "funding_signal_summary": lead["funding_signal_summary"],
        "globalization_signal_summary": lead["globalization_signal_summary"],
        "infra_demand_likelihood": lead["infra_demand_likelihood"],
        "target_contact_roles": lead["target_contact_roles"],
        "recommended_opening_angle": lead["recommended_opening_angle"],
        "final_lead_score": score["final_lead_score"],
        "confidence": score["qualification_confidence"],
        "rationale": score["score_rationale"],
    }


@router.get("/export", response_model=ExportResponse)
async def export_leads(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    ids: str | None = None,
):
    leads = fetch_leads()
    if ids:
        allow = {item.strip() for item in ids.split(",") if item.strip()}
        leads = [lead for lead in leads if lead["id"] in allow]

    rows = export_rows(leads)
    columns = list(rows[0].keys()) if rows else []
    now = datetime.now(timezone.utc).isoformat()

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
        payload = output.getvalue()
    else:
        payload = json.dumps(rows, indent=2)

    return {
        "format": format,
        "generated_at": now,
        "record_count": len(rows),
        "columns": columns,
        "payload": payload,
    }
