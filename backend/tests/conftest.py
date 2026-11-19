from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

TEAM_DOMAIN = "https://team.cloudflareaccess.com"
ACCESS_AUD = "test-aud"
CLIENT_ID = "client-ios.access"


@pytest.fixture(scope="session")
def private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="session")
def other_private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def make_token(private_key: rsa.RSAPrivateKey):
    def make(claims: dict[str, Any] | None = None, key: Any = None) -> str:
        now = datetime.now(UTC)
        payload = {
            "iss": TEAM_DOMAIN,
            "aud": [ACCESS_AUD],
            "iat": now,
            "exp": now + timedelta(hours=1),
            "common_name": CLIENT_ID,
        }
        payload.update(claims or {})
        return jwt.encode(payload, key or private_key, algorithm="RS256")

    return make


@pytest.fixture
def cf_settings(tmp_path) -> Settings:
    return Settings(
        env="prod",
        auth_mode="cloudflare",
        dev_identity="",
        cf_team_domain=TEAM_DOMAIN,
        cf_access_aud=ACCESS_AUD,
        allowed_service_tokens={CLIENT_ID: "ios"},
        data_dir=tmp_path / "data",
        static_dir=None,
    )


@pytest.fixture
def cf_client(cf_settings: Settings, private_key: rsa.RSAPrivateKey) -> TestClient:
    app = create_app(cf_settings, signing_key_for=lambda _token: private_key.public_key())
    return TestClient(app)


@pytest.fixture
def dev_settings(tmp_path) -> Settings:
    return Settings(
        env="dev",
        auth_mode="dev",
        dev_identity="dev",
        cf_team_domain="",
        cf_access_aud="",
        allowed_service_tokens={},
        data_dir=tmp_path / "data",
        static_dir=None,
    )


@pytest.fixture
def dev_client(dev_settings: Settings) -> TestClient:
    return TestClient(create_app(dev_settings))
