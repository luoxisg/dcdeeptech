"""
auth.py — FastAPI dependency for Bearer token authentication.

Clients must supply: Authorization: Bearer <GATEWAY_API_KEY>
All /v1/* endpoints depend on verify_api_key.
"""

import logging

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


async def verify_api_key(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> str:
    """
    Validate the incoming Bearer token against GATEWAY_API_KEY.
    Returns the validated token on success; raises 401 on failure.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        logger.warning("auth: missing or non-Bearer Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.credentials != settings.gateway_api_key:
        logger.warning("auth: invalid API key presented")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return credentials.credentials
