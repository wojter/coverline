import logging
from datetime import UTC, datetime, timedelta

import pytest

from app.config import load_settings, parse_service_tokens

HEADER = "Cf-Access-Jwt-Assertion"


def test_valid_token_returns_device_label(cf_client, make_token):
    response = cf_client.get("/api/me", headers={HEADER: make_token()})

    assert response.status_code == 200
    assert response.json() == {"device": "ios"}


@pytest.mark.parametrize(
    "build",
    [
        pytest.param(lambda make, other: None, id="missing header"),
        pytest.param(lambda make, other: make(claims={"aud": ["other-aud"]}), id="wrong aud"),
        pytest.param(lambda make, other: make(claims={"iss": "https://evil"}), id="wrong iss"),
        pytest.param(
            lambda make, other: make(claims={"common_name": "unknown"}), id="unknown client"
        ),
        pytest.param(lambda make, other: make(key=other), id="wrong signature"),
        pytest.param(
            lambda make, other: make(claims={"exp": datetime.now(UTC) - timedelta(minutes=5)}),
            id="expired",
        ),
        pytest.param(lambda make, other: "not-a-jwt", id="malformed"),
    ],
)
def test_bad_token_is_401(cf_client, make_token, other_private_key, build):
    token = build(make_token, other_private_key)
    headers = {HEADER: token} if token else {}

    response = cf_client.get("/api/me", headers=headers)

    assert response.status_code == 401


def test_rejection_is_logged_without_the_token(cf_client, make_token, caplog):
    token = make_token(claims={"common_name": "unknown"})
    with caplog.at_level(logging.INFO, logger="coverline"):
        cf_client.get("/api/me", headers={HEADER: token})

    assert "token rejected: unknown client" in caplog.text
    assert token not in caplog.text


def test_acceptance_is_logged_with_the_label(cf_client, make_token, caplog):
    with caplog.at_level(logging.INFO, logger="coverline"):
        cf_client.get("/api/me", headers={HEADER: make_token()})

    assert "token accepted: ios" in caplog.text


def test_dev_mode_ignores_token_headers(dev_client):
    response = dev_client.get("/api/me", headers={HEADER: "anything"})

    assert response.json() == {"device": "dev"}


def test_dev_mode_refuses_prod_env():
    env = {"ENV": "prod", "AUTH_MODE": "dev", "DEV_IDENTITY": "dev", "DATA_DIR": "/tmp/x"}

    with pytest.raises(ValueError, match="requires ENV=dev"):
        load_settings(env)


def test_cloudflare_mode_needs_team_and_aud():
    with pytest.raises(ValueError, match="CF_TEAM_DOMAIN"):
        load_settings({"DATA_DIR": "/tmp/x"})


def test_load_settings_reads_the_environment():
    env = {
        "ENV": "prod",
        "AUTH_MODE": "cloudflare",
        "CF_TEAM_DOMAIN": "https://team.cloudflareaccess.com",
        "CF_ACCESS_AUD": "test-aud",
        "ALLOWED_SERVICE_TOKENS": "client-ios.access=ios, other.access=android",
        "DATA_DIR": "/data",
        "STATIC_DIR": "/app/static",
    }

    settings = load_settings(env)

    assert settings.allowed_service_tokens == {
        "client-ios.access": "ios",
        "other.access": "android",
    }
    assert str(settings.db_path) == "/data/coverline.db"
    assert str(settings.static_dir) == "/app/static"


def test_parse_service_tokens_ignores_blanks():
    assert parse_service_tokens("") == {}
    assert parse_service_tokens(" a=ios , ") == {"a": "ios"}
