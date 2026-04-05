"""Tests for API key lifecycle — creation, authentication, revocation."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from keys.generator import generate_key, generate_key_id
from keys.hashing import hash_key, verify_key


def test_key_has_correct_prefix():
    key = generate_key()
    assert key.startswith("sk-dcdt-")


def test_key_id_has_correct_prefix():
    key_id = generate_key_id()
    assert key_id.startswith("kdcdt_")


def test_hash_and_verify_round_trip():
    key = generate_key()
    hashed, salt = hash_key(key)
    assert verify_key(key, hashed, salt) is True


def test_wrong_key_fails_verification():
    key = generate_key()
    wrong_key = generate_key()
    hashed, salt = hash_key(key)
    assert verify_key(wrong_key, hashed, salt) is False


def test_hash_is_not_plaintext():
    key = generate_key()
    hashed, _ = hash_key(key)
    assert key not in hashed
