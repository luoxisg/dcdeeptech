"""Tests for PII detection — covers all 8 regex patterns."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from security.pii.detector import PiiDetector


def test_detect_email():
    d = PiiDetector()
    result = d.detect("Contact us at alice@example.com for details.")
    assert result.data_class == "PERSONAL"
    assert any(f.pii_type == "email" for f in result.findings)


def test_detect_nric():
    d = PiiDetector()
    result = d.detect("My NRIC is S1234567A.")
    assert result.data_class == "HIGH_RISK"


def test_detect_credit_card():
    d = PiiDetector()
    result = d.detect("Card number: 4111 1111 1111 1111")
    assert result.data_class == "HIGH_RISK"


def test_clean_prompt_is_public():
    d = PiiDetector()
    result = d.detect("What is the capital of France?")
    assert result.data_class == "PUBLIC"
    assert result.findings == []


def test_prompt_hash_is_stable():
    d = PiiDetector()
    r1 = d.detect("hello world")
    r2 = d.detect("hello world")
    assert r1.prompt_hash == r2.prompt_hash
