"""Read models for companies, funding, and scoring."""

from __future__ import annotations

import json
from typing import Iterable

from db.models import conn


def fetch_leads(
    *,
    search: str = "",
    region: str | None = None,
    min_score: int = 0,
    stage: str | None = None,
    usd_backed_only: bool = False,
    international_backing_only: bool = False,
) -> list[dict]:
    query = """
    SELECT
      c.*,
      f.id AS funding_id,
      f.announced_at,
      f.round_name,
      f.amount_usd_m,
      f.investors,
      f.funding_signal_summary,
      s.company_id AS score_company_id,
      s.funding_score,
      s.globalization_score,
      s.infra_fit_score,
      s.qualification_confidence,
      s.final_lead_score,
      s.score_rationale,
      s.last_qualified_at,
      s.target_roles,
      s.opening_angle
    FROM companies c
    JOIN funding_events f ON f.company_id = c.id
    JOIN lead_scores s ON s.company_id = c.id
    WHERE 1 = 1
    """
    params: list[object] = []

    if search:
        query += " AND (LOWER(c.name) LIKE ? OR LOWER(c.summary) LIKE ? OR LOWER(c.company_profile) LIKE ?)"
        token = f"%{search.lower()}%"
        params.extend([token, token, token])
    if region:
        query += " AND LOWER(c.global_regions) LIKE ?"
        params.append(f"%{region.lower()}%")
    if stage:
        query += " AND c.stage = ?"
        params.append(stage)
    if usd_backed_only:
        query += " AND c.is_usd_backed = 1"
    if international_backing_only:
        query += " AND c.international_backing = 1"
    query += " AND s.final_lead_score >= ?"
    params.append(min_score)
    query += " ORDER BY s.final_lead_score DESC, f.amount_usd_m DESC"

    with conn() as connection:
        rows = connection.execute(query, params).fetchall()
    return [row_to_lead_card(row) for row in rows]


def fetch_lead(company_id: str) -> dict | None:
    results = fetch_leads()
    for row in results:
        if row["id"] == company_id:
            return row
    return None


def row_to_lead_card(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "normalized_name": row["normalized_name"],
        "website": row["website"],
        "hq_country": row["hq_country"],
        "china_link_type": row["china_link_type"],
        "global_regions": json.loads(row["global_regions"]),
        "summary": row["summary"],
        "company_profile": row["company_profile"],
        "funding_signal_summary": row["funding_signal_summary"],
        "globalization_signal_summary": row["globalization_signal_summary"],
        "infra_demand_likelihood": row["infra_demand_likelihood"],
        "target_contact_roles": json.loads(row["target_contact_roles"]),
        "recommended_opening_angle": row["recommended_opening_angle"],
        "employee_band": row["employee_band"],
        "stage": row["stage"],
        "is_usd_backed": bool(row["is_usd_backed"]),
        "international_backing": bool(row["international_backing"]),
        "latest_funding_event": {
            "id": row["funding_id"],
            "company_id": row["id"],
            "announced_at": row["announced_at"],
            "round_name": row["round_name"],
            "amount_usd_m": row["amount_usd_m"],
            "investors": json.loads(row["investors"]),
            "funding_signal_summary": row["funding_signal_summary"],
        },
        "lead_score": {
            "company_id": row["score_company_id"],
            "funding_score": row["funding_score"],
            "globalization_score": row["globalization_score"],
            "infra_fit_score": row["infra_fit_score"],
            "qualification_confidence": row["qualification_confidence"],
            "final_lead_score": row["final_lead_score"],
            "score_rationale": row["score_rationale"],
            "last_qualified_at": row["last_qualified_at"],
            "target_roles": json.loads(row["target_roles"]),
            "opening_angle": row["opening_angle"],
        },
    }


def export_rows(leads: Iterable[dict]) -> list[dict]:
    return [
        {
            "company": lead["name"],
            "hq_country": lead["hq_country"],
            "website": lead["website"],
            "stage": lead["stage"],
            "final_lead_score": lead["lead_score"]["final_lead_score"],
            "funding_signal_summary": lead["funding_signal_summary"],
            "globalization_signal_summary": lead["globalization_signal_summary"],
            "infra_demand_likelihood": lead["infra_demand_likelihood"],
            "target_contact_roles": ", ".join(lead["target_contact_roles"]),
            "recommended_opening_angle": lead["recommended_opening_angle"],
        }
        for lead in leads
    ]
