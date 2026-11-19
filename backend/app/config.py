import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    env: str
    auth_mode: str
    dev_identity: str
    cf_team_domain: str
    cf_access_aud: str
    allowed_service_tokens: dict[str, str]
    data_dir: Path
    static_dir: Path | None

    @property
    def db_path(self) -> Path:
        return self.data_dir / "coverline.db"


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    settings = Settings(
        env=env.get("ENV", "prod"),
        auth_mode=env.get("AUTH_MODE", "cloudflare"),
        dev_identity=env.get("DEV_IDENTITY", ""),
        cf_team_domain=env.get("CF_TEAM_DOMAIN", ""),
        cf_access_aud=env.get("CF_ACCESS_AUD", ""),
        allowed_service_tokens=parse_service_tokens(env.get("ALLOWED_SERVICE_TOKENS", "")),
        data_dir=Path(_required(env, "DATA_DIR")),
        static_dir=Path(env["STATIC_DIR"]) if env.get("STATIC_DIR") else None,
    )
    validate(settings)
    return settings


def parse_service_tokens(text: str) -> dict[str, str]:
    pairs = (item.strip().partition("=") for item in text.split(",") if item.strip())
    return {client_id.strip(): label.strip() for client_id, _, label in pairs}


def validate(settings: Settings) -> None:
    if settings.env not in ("dev", "prod"):
        raise ValueError("ENV must be dev or prod")
    if settings.auth_mode == "dev":
        if settings.env != "dev":
            raise ValueError("AUTH_MODE=dev requires ENV=dev")
        if not settings.dev_identity:
            raise ValueError("AUTH_MODE=dev requires DEV_IDENTITY")
    elif settings.auth_mode == "cloudflare":
        if not settings.cf_team_domain or not settings.cf_access_aud:
            raise ValueError("AUTH_MODE=cloudflare requires CF_TEAM_DOMAIN and CF_ACCESS_AUD")
    else:
        raise ValueError("AUTH_MODE must be cloudflare or dev")


def _required(env: Mapping[str, str], name: str) -> str:
    value = env.get(name, "")
    if not value:
        raise ValueError(f"{name} is required")
    return value
