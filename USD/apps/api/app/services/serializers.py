from __future__ import annotations

from packages.llm.service import build_summary


def iso(value):
    return value.isoformat() if value else None


def signal_to_model(signal):
    latest_review = signal.reviews[0] if signal.reviews else None
    return {
        "signal_id": signal.signal_id,
        "company_id": signal.company_id,
        "signal_type": signal.signal_type,
        "signal_subtype": signal.signal_subtype,
        "title": signal.title,
        "evidence_text": signal.evidence_text,
        "source_url": signal.source_url,
        "source_date": iso(signal.source_date),
        "confidence": signal.confidence,
        "raw_metadata": signal.raw_metadata,
        "mapped_fields": signal.raw_metadata.get("mapped_fields", []),
        "created_at": iso(signal.created_at),
        "review_status": latest_review.review_status if latest_review else None,
        "review_note": latest_review.note if latest_review else None,
        "reviewed_at": iso(latest_review.reviewed_at) if latest_review else None,
    }


def company_to_model(company):
    return {
        "company_id": company.company_id,
        "company_name_cn": company.company_name_cn,
        "company_name_en": company.company_name_en,
        "website": company.website,
        "domain": company.domain,
        "industry_primary": company.industry_primary,
        "industry_secondary": company.industry_secondary,
        "company_type": company.company_type,
        "china_linked": company.china_linked,
        "china_link_strength": company.china_link_strength,
        "hq_country": company.hq_country,
        "hq_city": company.hq_city,
        "operating_regions": company.operating_regions,
        "english_site": company.english_site,
        "status": company.status,
        "description": company.description,
        "source_count": company.source_count,
        "last_seen_at": iso(company.last_seen_at),
        "created_at": iso(company.created_at),
        "updated_at": iso(company.updated_at),
    }


def score_to_model(score):
    return {
        "score_id": score.score_id,
        "company_id": score.company_id,
        "agent_type": score.agent_type,
        "fit_score": score.fit_score,
        "confidence_score": score.confidence_score,
        "priority_tier": score.priority_tier,
        "reasons": score.reasons,
        "recommended_roles": score.recommended_roles,
        "opening_angle": score.opening_angle,
        "next_action": score.next_action,
        "likely_needs": score.likely_needs,
        "hybrid_tag": score.hybrid_tag,
        "updated_at": iso(score.updated_at),
    }


def funding_to_model(event):
    return {
        "funding_id": event.funding_id,
        "company_id": event.company_id,
        "round_name": event.round_name,
        "announce_date": iso(event.announce_date),
        "amount_text": event.amount_text,
        "currency_hint": event.currency_hint,
        "investors": event.investors,
        "international_investor_flag": event.international_investor_flag,
        "offshore_entity_hint": event.offshore_entity_hint,
        "source_url": event.source_url,
        "confidence": event.confidence,
    }


def build_lead_card(company):
    ordered_scores = sorted(company.scores, key=lambda item: item.fit_score, reverse=True)
    primary = ordered_scores[0]
    secondary = ordered_scores[1] if len(ordered_scores) > 1 else None
    latest_signal = sorted(company.signals, key=lambda item: item.source_date, reverse=True)[0] if company.signals else None
    return {
        "company": company_to_model(company),
        "primary_score": score_to_model(primary),
        "secondary_score": score_to_model(secondary) if secondary else None,
        "latest_signal": signal_to_model(latest_signal) if latest_signal else None,
        "evidence_count": len(company.signals),
        "why_matched": primary.reasons,
        "likely_needs": primary.likely_needs,
        "recommended_roles": primary.recommended_roles,
        "opening_angle_summary": primary.opening_angle,
    }


def build_lead_detail(company):
    ordered_scores = sorted(company.scores, key=lambda item: item.fit_score, reverse=True)
    primary = ordered_scores[0]
    secondary = ordered_scores[1] if len(ordered_scores) > 1 else None
    summary = build_summary(company_to_model(company), _score_obj(primary), _score_obj(secondary) if secondary else None, [signal_to_model(item) for item in company.signals])
    return {
        "company": company_to_model(company),
        "primary_score": score_to_model(primary),
        "secondary_score": score_to_model(secondary) if secondary else None,
        "funding_events": [funding_to_model(item) for item in company.funding_events],
        "signals": [signal_to_model(item) for item in sorted(company.signals, key=lambda item: item.source_date, reverse=True)],
        "timeline": [signal_to_model(item) for item in sorted(company.signals, key=lambda item: item.source_date, reverse=True)],
        "evidence_count": len(company.signals),
        "company_summary": summary["company_summary"],
        "why_matched": summary["why_matched"],
        "likely_needs": summary["likely_needs"],
        "recommended_roles": summary["recommended_roles"],
        "opening_angle": summary["opening_angle"],
        "risk_note": summary["risk_note"],
        "watchlist_entry": None if not company.watchlists else {
            "watchlist_id": company.watchlists[0].watchlist_id,
            "company_id": company.watchlists[0].company_id,
            "notes": company.watchlists[0].notes,
            "tags": company.watchlists[0].tags,
            "created_at": iso(company.watchlists[0].created_at),
        },
    }


class _score_obj:
    def __init__(self, score):
        self.agent_type = type("AgentTypeValue", (), {"value": score.agent_type})()
        self.fit_score = score.fit_score
        self.priority_tier = type("TierValue", (), {"value": score.priority_tier})()
        self.reasons = score.reasons
        self.likely_needs = score.likely_needs
        self.recommended_roles = score.recommended_roles
        self.opening_angle = score.opening_angle
        self.confidence_score = score.confidence_score
