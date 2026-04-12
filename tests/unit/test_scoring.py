from packages.connectors.fixtures import DEMO_FIXTURES
from packages.scoring.service import score_company, tier_from_score


def test_priority_tier_mapping():
    assert tier_from_score(85).value == "P1"
    assert tier_from_score(65).value == "P2"
    assert tier_from_score(45).value == "P3"
    assert tier_from_score(15).value == "Reject"


def test_vie_usd_company_prefers_agent_a():
    fixture = DEMO_FIXTURES[0]
    scores = score_company(fixture["company"], fixture["signals"], fixture["funding_events"])
    assert scores[0].agent_type.value == "vie_usd"
    assert scores[0].fit_score > scores[1].fit_score


def test_heavy_asset_company_prefers_agent_c():
    fixture = DEMO_FIXTURES[4]
    scores = score_company(fixture["company"], fixture["signals"], fixture["funding_events"])
    assert scores[0].agent_type.value == "heavy_asset_global"
    assert scores[0].priority_tier.value in {"P1", "P2"}
