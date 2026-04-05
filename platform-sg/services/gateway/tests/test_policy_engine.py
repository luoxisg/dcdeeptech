"""Tests for the YAML-driven policy engine."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from policy.engine import PolicyEngine


@pytest.fixture
def engine():
    config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
    return PolicyEngine(config_dir=config_dir)


def test_public_routes_to_cq(engine):
    decision = engine.evaluate("PUBLIC")
    assert decision.allow is True
    assert decision.destination_region == "cq"
    assert decision.requires_redaction is False


def test_personal_routes_to_sg_with_redaction(engine):
    decision = engine.evaluate("PERSONAL")
    assert decision.allow is True
    assert decision.destination_region == "sg"
    assert decision.requires_redaction is True


def test_high_risk_is_denied(engine):
    decision = engine.evaluate("HIGH_RISK")
    assert decision.allow is False
    assert decision.deny_reason is not None
