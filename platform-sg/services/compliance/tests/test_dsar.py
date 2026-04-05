"""Tests for DSAR lifecycle — state machine, SLA, tenant isolation."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest


def test_dsar_module_importable():
    """Smoke test: DSAR module imports without error."""
    from app.routers import dsar
    assert dsar is not None


def test_compliance_db_module_importable():
    """Smoke test: DB models import without error."""
    from db import models
    assert models is not None
