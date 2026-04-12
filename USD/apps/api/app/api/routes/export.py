from __future__ import annotations

import base64
import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from openpyxl import Workbook
from sqlalchemy.orm import Session, selectinload

from ...db.session import get_db
from ...schemas.models import ExportRequestModel, ExportResponseModel
from ...services.serializers import build_lead_card
from packages.db.models import Company, Watchlist

router = APIRouter()

CRM_COLUMNS = [
    "company_id",
    "company_name_cn",
    "company_name_en",
    "primary_agent",
    "secondary_agent",
    "fit_score",
    "confidence_score",
    "priority_tier",
    "industry",
    "regions",
    "likely_needs",
    "recommended_roles",
    "opening_angle",
    "why_matched",
    "latest_signal_title",
    "evidence_count",
    "website",
]


def _rows(companies):
    rows = []
    for company in companies:
        lead = build_lead_card(company)
        rows.append(
            {
                "company_id": lead["company"]["company_id"],
                "company_name_cn": lead["company"]["company_name_cn"],
                "company_name_en": lead["company"]["company_name_en"],
                "primary_agent": lead["primary_score"]["agent_type"],
                "secondary_agent": lead["secondary_score"]["agent_type"] if lead["secondary_score"] else "",
                "fit_score": lead["primary_score"]["fit_score"],
                "confidence_score": lead["primary_score"]["confidence_score"],
                "priority_tier": lead["primary_score"]["priority_tier"],
                "industry": lead["company"]["industry_primary"],
                "regions": ", ".join(lead["company"]["operating_regions"]),
                "likely_needs": "; ".join(lead["likely_needs"]),
                "recommended_roles": "; ".join(lead["recommended_roles"]),
                "opening_angle": lead["opening_angle_summary"],
                "why_matched": "; ".join(lead["why_matched"]),
                "latest_signal_title": lead["latest_signal"]["title"] if lead["latest_signal"] else "",
                "evidence_count": lead["evidence_count"],
                "website": lead["company"]["website"] or "",
            }
        )
    return rows


@router.post("/export", response_model=ExportResponseModel)
def export_leads(payload: ExportRequestModel, db: Session = Depends(get_db)):
    query = db.query(Company).options(selectinload(Company.signals), selectinload(Company.scores))
    if payload.watchlist_only:
        ids = [item.company_id for item in db.query(Watchlist).all()]
        query = query.filter(Company.company_id.in_(ids))
    elif payload.company_ids:
        query = query.filter(Company.company_id.in_(payload.company_ids))

    rows = _rows(query.all())
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")

    if payload.format == "json":
        return {
            "format": "json",
            "filename": f"lead-intel-export-{stamp}.json",
            "content_type": "application/json",
            "payload": json.dumps(rows, indent=2),
            "exported_count": len(rows),
        }
    if payload.format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=CRM_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
        return {
            "format": "csv",
            "filename": f"lead-intel-export-{stamp}.csv",
            "content_type": "text/csv",
            "payload": output.getvalue(),
            "exported_count": len(rows),
        }

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Lead Export"
    sheet.append(CRM_COLUMNS)
    for row in rows:
        sheet.append([row[column] for column in CRM_COLUMNS])
    stream = io.BytesIO()
    workbook.save(stream)
    return {
        "format": "xlsx",
        "filename": f"lead-intel-export-{stamp}.xlsx",
        "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "payload": base64.b64encode(stream.getvalue()).decode("utf-8"),
        "exported_count": len(rows),
    }
