import logging
import time
from collections.abc import Awaitable, Callable
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, PlainTextResponse

from app import export, sync
from app.auth import Device, SigningKeyLookup, jwks_signing_key
from app.config import Settings, load_settings
from app.db import init_db

log = logging.getLogger("coverline")

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data:; object-src 'none'; "
        "base-uri 'none'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
}
NO_CACHE_FILES = {"index.html", "sw.js", "manifest.webmanifest"}
IMMUTABLE = "public, max-age=31536000, immutable"


def create_app(
    settings: Settings | None = None, signing_key_for: SigningKeyLookup | None = None
) -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    settings = settings or load_settings()
    init_db(settings.db_path)

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    if signing_key_for is None and settings.auth_mode == "cloudflare":
        signing_key_for = jwks_signing_key(settings)
    app.state.signing_key_for = signing_key_for

    app.middleware("http")(common_headers_and_log)

    api = APIRouter(prefix="/api")

    @api.get("/health", response_class=PlainTextResponse)
    def health() -> str:
        return "ok"

    @api.get("/me")
    def me(device: Device) -> dict[str, str]:
        return {"device": device}

    app.include_router(api)
    app.include_router(sync.router, prefix="/api")
    app.include_router(export.router, prefix="/api")

    if settings.static_dir and settings.static_dir.is_dir():
        _mount_static(app, settings.static_dir)
    return app


async def common_headers_and_log(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    started = time.perf_counter()
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elapsed_ms = (time.perf_counter() - started) * 1000
    log.info("%s %s %d %.1fms", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


def _mount_static(app: FastAPI, static_dir: Path) -> None:
    root = static_dir.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def static_or_shell(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return _file_response(candidate, root)
        if path.startswith("assets/"):
            raise HTTPException(status_code=404)
        return _file_response(root / "index.html", root)


def _file_response(path: Path, root: Path) -> FileResponse:
    if path.relative_to(root).parts[0] == "assets":
        return FileResponse(path, headers={"Cache-Control": IMMUTABLE})
    if path.name in NO_CACHE_FILES:
        return FileResponse(path, headers={"Cache-Control": "no-cache"})
    return FileResponse(path)
