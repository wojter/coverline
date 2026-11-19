import logging
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from app.config import Settings, load_settings
from app.db import connect

log = logging.getLogger("coverline")

KEEP = 30


def backup_dir(settings: Settings) -> Path:
    return settings.data_dir / "backup"


def run_backup(settings: Settings) -> Path:
    if not settings.db_path.exists():
        raise FileNotFoundError("no database to back up")
    directory = backup_dir(settings)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"coverline-{datetime.now(UTC):%Y%m%dT%H%M%SZ}.db"

    source = connect(settings.db_path)
    destination = sqlite3.connect(target)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()

    _prune(directory)
    log.info("backup written: %s", target.name)
    return target


def _prune(directory: Path) -> None:
    copies = sorted(directory.glob("coverline-*.db"), reverse=True)
    for old in copies[KEEP:]:
        old.unlink()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_backup(load_settings())
