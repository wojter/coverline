import logging
from collections.abc import Callable
from typing import Annotated, Any, NoReturn

import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient

from app.config import Settings

log = logging.getLogger("coverline")

SigningKeyLookup = Callable[[str], Any]


def jwks_signing_key(settings: Settings) -> SigningKeyLookup:
    client = PyJWKClient(f"{settings.cf_team_domain}/cdn-cgi/access/certs", cache_keys=True)

    def lookup(token: str) -> Any:
        return client.get_signing_key_from_jwt(token).key

    return lookup


def require_device(request: Request) -> str:
    settings: Settings = request.app.state.settings
    if settings.auth_mode == "dev":
        return settings.dev_identity

    token = request.headers.get("cf-access-jwt-assertion")
    if not token:
        _reject("missing header")
    try:
        key = request.app.state.signing_key_for(token)
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.cf_access_aud,
            issuer=settings.cf_team_domain,
            options={"require": ["exp", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        _reject("invalid token")

    label = settings.allowed_service_tokens.get(claims.get("common_name", ""))
    if label is None:
        _reject("unknown client")
    log.info("token accepted: %s", label)
    return label


def _reject(reason: str) -> NoReturn:
    log.warning("token rejected: %s", reason)
    raise HTTPException(status_code=401, detail="unauthorized")


Device = Annotated[str, Depends(require_device)]
