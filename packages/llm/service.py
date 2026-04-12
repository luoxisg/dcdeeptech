from __future__ import annotations

from packages.scoring.service import ScoreResult


def build_summary(company: dict, primary: ScoreResult, secondary: ScoreResult | None, evidence: list[dict]) -> dict:
    thin_evidence = len(evidence) < 2 or primary.confidence_score < 70
    return {
        "company_summary": f"{company['company_name_en']} is a China-linked {company['industry_primary'].lower()} company with visible international operating signals.",
        "primary_agent_type": primary.agent_type.value,
        "secondary_agent_type": secondary.agent_type.value if secondary and secondary.fit_score >= 60 else None,
        "fit_score": int(round(primary.fit_score)),
        "priority_tier": primary.priority_tier.value,
        "why_matched": primary.reasons,
        "likely_needs": primary.likely_needs,
        "recommended_roles": primary.recommended_roles,
        "opening_angle": primary.opening_angle,
        "risk_note": "Evidence is thinner than ideal; validate corporate structure and buyer ownership before outreach." if thin_evidence else "Evidence quality is sufficient for BD qualification.",
    }
