"""
DCDeepTech API Key generator.

Key format:  sk-dcdt-<32 url-safe random bytes in base64>
Key ID:      kdcdt_<8 url-safe random bytes>  (short, used for lookups)
Prefix:      First 16 characters of the full key + "..."  (stored & displayed)

The full key is returned ONCE at creation time and never stored.
Only the prefix (for display) and a salted PBKDF2 hash are persisted.
"""

import secrets

_KEY_PREFIX = "sk-dcdt"


def generate_api_key() -> tuple[str, str]:
    """
    Generate a new DCDeepTech API key.

    Returns:
        (full_key, key_id)
        - full_key  — returned to caller ONCE; never stored in plaintext
        - key_id    — stable identifier for audit / management operations
    """
    key_id = f"kdcdt_{secrets.token_urlsafe(8)}"
    random_part = secrets.token_urlsafe(32)
    full_key = f"{_KEY_PREFIX}-{random_part}"
    return full_key, key_id


def extract_prefix(key: str) -> str:
    """
    Return the displayable, non-sensitive prefix of a key.
    Stored in the database so operators can identify keys without the secret.

    Example:  "sk-dcdt-AbCdEf..." → "sk-dcdt-AbCdEf..."
    """
    return key[:16] + "..."
