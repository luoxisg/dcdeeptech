from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from packages.db.models import AgentType, PriorityTier


@dataclass
class ScoreResult:
    agent_type: AgentType
    fit_score: float
    confidence_score: float
    priority_tier: PriorityTier
    reasons: list[str]
    recommended_roles: list[str]
    opening_angle: str
    next_action: str
    likely_needs: list[str]


def tier_from_score(score: float) -> PriorityTier:
    if score >= 80:
        return PriorityTier.P1
    if score >= 60:
        return PriorityTier.P2
    if score >= 40:
        return PriorityTier.P3
    return PriorityTier.REJECT


def _contains(flags: Iterable[str], *expected: str) -> bool:
    haystack = {flag.lower() for flag in flags}
    return any(item.lower() in haystack for item in expected)


def score_company(company: dict, signals: list[dict], funding_events: list[dict]) -> list[ScoreResult]:
    flags: list[str] = []
    for signal in signals:
        flags.extend(signal.get("raw_metadata", {}).get("flags", []))

    operating_regions = company.get("operating_regions", [])
    has_international_funding = any(item.get("international_investor_flag") for item in funding_events)
    has_usd = any((item.get("currency_hint") or "").upper() == "USD" for item in funding_events) or _contains(flags, "usd")

    usd_funding_score = 92 if has_usd else 64 if has_international_funding else 25
    offshore_structure_score = 92 if _contains(flags, "cayman", "spv", "holdco", "hong_kong") else 58 if any(item.get("offshore_entity_hint") for item in funding_events) else 18
    compliance_need_score = 88 if _contains(flags, "esop", "stock_option", "fx") else 58 if _contains(flags, "finance_hiring", "legal_hiring") else 24
    contactability_score = 86 if _contains(flags, "finance_hiring", "legal_hiring", "platform_hiring", "tax_hiring") else 48 if company.get("english_site") else 18
    fit_score_a = 0.35 * usd_funding_score + 0.25 * offshore_structure_score + 0.20 * compliance_need_score + 0.20 * contactability_score

    digital_globalization_score = 90 if _contains(flags, "app_store", "subscriptions", "multi_country_pricing") else 63 if len(operating_regions) >= 3 else 20
    tax_complexity_score = 88 if _contains(flags, "vat_gst", "payments", "billing") else 56 if _contains(flags, "compliance", "tax_hiring") else 18
    platform_infra_need_score = 84 if _contains(flags, "platform_hiring", "payments", "compliance") else 52 if company.get("industry_primary") in {"Gaming", "SaaS"} else 16
    fit_score_b = 0.30 * digital_globalization_score + 0.30 * tax_complexity_score + 0.20 * platform_infra_need_score + 0.20 * contactability_score

    overseas_factory_score = 94 if _contains(flags, "factory", "vietnam") else 62 if _contains(flags, "procurement_center") else 20
    tp_customs_complexity_score = 90 if _contains(flags, "transfer_pricing", "customs", "intercompany") else 60 if _contains(flags, "cash_management") else 18
    treasury_hq_score = 85 if _contains(flags, "treasury", "procurement_center", "cash_management") else 55 if len(operating_regions) >= 3 else 20
    enterprise_value_score = 88 if _contains(flags, "listed_group", "capex") or company.get("company_type") == "Listed Group" else 58 if company.get("source_count", 0) >= 4 else 22
    fit_score_c = 0.30 * overseas_factory_score + 0.30 * tp_customs_complexity_score + 0.20 * treasury_hq_score + 0.20 * enterprise_value_score

    evidence_confidence = round(sum(signal.get("confidence", 0) for signal in signals) / max(len(signals), 1) * 100, 1)

    return sorted(
        [
            ScoreResult(
                agent_type=AgentType.VIE_USD,
                fit_score=round(fit_score_a, 1),
                confidence_score=evidence_confidence,
                priority_tier=tier_from_score(fit_score_a),
                reasons=[
                    "Public signals indicate offshore structuring or holdco complexity.",
                    "Funding and hiring evidence suggests finance, legal, or FX execution pressure.",
                    "China-linked group appears reachable through senior finance or founder-office functions.",
                ],
                recommended_roles=["CFO", "General Counsel", "Head of Finance", "Founder Office", "Corporate Development"],
                opening_angle="Reduce offshore structure mismatch, FX compliance risk, ESOP execution friction, and regional holdco substance risk.",
                next_action="Prioritize CFO / finance-led outreach with evidence from funding and hiring signals.",
                likely_needs=["Offshore structure review", "FX compliance design", "ESOP / RSU administration", "Regional holdco substance planning"],
            ),
            ScoreResult(
                agent_type=AgentType.DIGITAL_GLOBAL,
                fit_score=round(fit_score_b, 1),
                confidence_score=evidence_confidence,
                priority_tier=tier_from_score(fit_score_b),
                reasons=[
                    "Digital go-to-market footprint spans multiple countries and platforms.",
                    "Signals show VAT, payments, subscriptions, or platform compliance complexity.",
                    "International operating model suggests need for coordinated finance and platform design.",
                ],
                recommended_roles=["COO", "VP Finance", "Head of International", "Head of Platform", "Head of Payments"],
                opening_angle="Help structure global digital operations, payments, VAT/GST complexity, platform delivery, and regional operating model.",
                next_action="Lead with international finance and payments friction points tied to current expansion signals.",
                likely_needs=["VAT / GST design", "Payments operating model", "Platform compliance support", "Regional HQ design"],
            ),
            ScoreResult(
                agent_type=AgentType.HEAVY_ASSET_GLOBAL,
                fit_score=round(fit_score_c, 1),
                confidence_score=evidence_confidence,
                priority_tier=tier_from_score(fit_score_c),
                reasons=[
                    "Evidence points to overseas plant, assembly, or procurement expansion.",
                    "Cross-border manufacturing flows create transfer pricing and customs valuation exposure.",
                    "Regional treasury and supply-chain finance needs are visible in public signals.",
                ],
                recommended_roles=["Group Tax", "Treasury", "Regional CFO", "Supply Chain Finance", "Strategy / CEO Office"],
                opening_angle="Reduce supply-chain tax friction, transfer pricing risk, customs valuation mismatch, and regional treasury / HQ design complexity.",
                next_action="Open with treasury, customs, and transfer-pricing implications of newly visible overseas operations.",
                likely_needs=["Transfer pricing policy", "Customs valuation alignment", "Regional treasury design", "Supply-chain tax structuring"],
            ),
        ],
        key=lambda item: item.fit_score,
        reverse=True,
    )
