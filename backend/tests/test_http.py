import dataclasses

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

CSP = (
    "default-src 'self'; img-src 'self' data:; object-src 'none'; "
    "base-uri 'none'; frame-ancestors 'none'"
)


@pytest.fixture
def static_dir(tmp_path):
    root = tmp_path / "static"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text("<html>shell</html>")
    (root / "sw.js").write_text("// sw")
    (root / "manifest.webmanifest").write_text("{}")
    (root / "assets" / "app-abc.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("secret")
    return root


@pytest.fixture
def shell_client(cf_settings: Settings, static_dir, private_key) -> TestClient:
    settings = dataclasses.replace(cf_settings, static_dir=static_dir)
    app = create_app(settings, signing_key_for=lambda _token: private_key.public_key())
    return TestClient(app)


def test_health_is_plain_text_without_auth(cf_client):
    response = cf_client.get("/api/health")

    assert response.status_code == 200
    assert response.text == "ok"
    assert response.headers["content-type"].startswith("text/plain")


def test_every_response_has_security_headers(cf_client):
    for response in (cf_client.get("/api/health"), cf_client.get("/api/me")):
        assert response.headers["content-security-policy"] == CSP
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["referrer-policy"] == "no-referrer"


def test_api_responses_are_not_cached(cf_client):
    assert cf_client.get("/api/health").headers["cache-control"] == "no-store"


def test_unknown_api_path_is_json_404(cf_client):
    response = cf_client.get("/api/nope")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_shell_is_served_at_root_with_no_cache(shell_client):
    response = shell_client.get("/")

    assert response.status_code == 200
    assert response.text == "<html>shell</html>"
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["content-security-policy"] == CSP


def test_unknown_route_falls_back_to_shell(shell_client):
    response = shell_client.get("/entry/2026-11-18")

    assert response.status_code == 200
    assert response.text == "<html>shell</html>"


def test_worker_files_are_not_cached(shell_client):
    assert shell_client.get("/sw.js").headers["cache-control"] == "no-cache"
    assert shell_client.get("/manifest.webmanifest").headers["cache-control"] == "no-cache"


def test_assets_are_immutable(shell_client):
    response = shell_client.get("/assets/app-abc.js")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_missing_asset_is_404_not_shell(shell_client):
    response = shell_client.get("/assets/missing.js")

    assert response.status_code == 404


def test_api_paths_never_fall_back_to_shell(shell_client):
    response = shell_client.get("/api/nope")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_path_traversal_stays_inside_static_dir(shell_client):
    response = shell_client.get("/%2e%2e/secret.txt")

    assert response.text == "<html>shell</html>"


def test_api_runs_without_static_dir(cf_client):
    assert cf_client.get("/api/health").text == "ok"
    assert cf_client.get("/").status_code == 404
