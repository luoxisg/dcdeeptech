"""
API key hashing utilities.

Uses PBKDF2-HMAC-SHA256 with a per-key random salt.
Iteration count follows OWASP 2024 recommendation for PBKDF2-SHA256.
Comparison uses hmac.compare_digest to prevent timing attacks.
"""

import hashlib
import hmac
import secrets

# OWASP recommended minimum for PBKDF2-SHA256 (2024)
_ITERATIONS = 260_000


def hash_key(key: str) -> tuple[str, str]:
    """
    Hash a plaintext API key for persistent storage.

    Returns:
        (salt_hex, hash_hex)  — both stored alongside key metadata
    """
    salt = secrets.token_bytes(32)
    digest = hashlib.pbkdf2_hmac("sha256", key.encode(), salt, _ITERATIONS)
    return salt.hex(), digest.hex()


def verify_key(key: str, salt_hex: str, stored_hash_hex: str) -> bool:
    """
    Constant-time verification of a plaintext key against stored hash.
    Prevents timing-based enumeration of valid keys.
    """
    salt = bytes.fromhex(salt_hex)
    computed = hashlib.pbkdf2_hmac("sha256", key.encode(), salt, _ITERATIONS)
    return hmac.compare_digest(computed.hex(), stored_hash_hex)
