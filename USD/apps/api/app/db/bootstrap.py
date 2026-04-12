from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from packages.connectors.fixtures import DEMO_FIXTURES
from packages.db.models import AgentScore, Company, CompanySignal, FundingEvent, Search, SignalReview, Watchlist
from packages.llm.service import build_summary
from packages.scoring.service import score_company


def seed_demo_data(db: Session) -> None:
    if db.query(Company).count():
        return

    for fixture in DEMO_FIXTURES:
        company = Company(**fixture["company"], last_seen_at=datetime.utcnow())
        db.add(company)
        db.flush()

        signal_models = []
        for signal in fixture["signals"]:
            signal_payload = {key: value for key, value in signal.items() if key != "source_date"}
            signal_model = CompanySignal(
                **signal_payload,
                company_id=company.company_id,
                source_date=datetime.fromisoformat(signal["source_date"]),
            )
            db.add(signal_model)
            signal_models.append(signal_model)

        funding_models = []
        for funding in fixture["funding_events"]:
            funding_payload = {key: value for key, value in funding.items() if key != "announce_date"}
            funding_model = FundingEvent(
                **funding_payload,
                company_id=company.company_id,
                announce_date=datetime.fromisoformat(funding["announce_date"]),
            )
            db.add(funding_model)
            funding_models.append(funding_model)

        scored = score_company(fixture["company"], fixture["signals"], fixture["funding_events"])
        primary = scored[0]
        secondary = scored[1]
        hybrid = "hybrid" if secondary.fit_score >= 70 else None

        for result in scored:
            db.add(
                AgentScore(
                    score_id=str(uuid4()),
                    company_id=company.company_id,
                    agent_type=result.agent_type.value,
                    fit_score=result.fit_score,
                    confidence_score=result.confidence_score,
                    priority_tier=result.priority_tier.value,
                    reasons=result.reasons,
                    recommended_roles=result.recommended_roles,
                    opening_angle=result.opening_angle,
                    next_action=result.next_action,
                    likely_needs=result.likely_needs,
                    hybrid_tag=hybrid,
                )
            )

        summary = build_summary(fixture["company"], primary, secondary, fixture["signals"])
        company.description = summary["company_summary"]

        if fixture.get("watchlist"):
            db.add(
                Watchlist(
                    watchlist_id=str(uuid4()),
                    company_id=company.company_id,
                    notes=fixture["watchlist"]["notes"],
                    tags=fixture["watchlist"]["tags"],
                )
            )

    db.add(
        Search(
            search_id=str(uuid4()),
            user_query_name="P1 cross-border expansion targets",
            filters_json={"minimum_score": 80, "agent_type": ""},
            result_count=4,
        )
    )
    db.commit()
