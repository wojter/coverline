import argparse
import logging
import os
import secrets
import shutil
import sqlite3
from pathlib import Path

from app.config import Settings, load_settings
from app.db import connect
from app.migrations import SCHEMA_VERSION

log = logging.getLogger("coverline")


class RestoreError(Exception):
    pass


def run_restore(settings: Settings, source: Path) -> None:
    _check_backup(source)
    staging = settings.data_dir / "coverline.db.restore"
    shutil.copyfile(source, staging)
    _new_data_version(staging)
    _remove_stale_journals(settings.db_path)
    os.replace(staging, settings.db_path)
    log.info("restored from %s", source.name)


def _check_backup(path: Path) -> None:
    if not path.is_file():
        raise RestoreError("file not found")
    try:
        conn = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
        try:
            integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            version = conn.execute("PRAGMA user_version").fetchone()[0]
        finally:
            conn.close()
    except sqlite3.DatabaseError as exc:
        raise RestoreError("not a readable SQLite database") from exc
    if integrity != "ok":
        raise RestoreError("integrity_check failed")
    if version != SCHEMA_VERSION:
        raise RestoreError("unexpected schema version")


def _new_data_version(path: Path) -> None:
    conn = connect(path)
    try:
        conn.execute(
            "UPDATE meta SET value = ? WHERE key = 'data_version'", (secrets.token_hex(6),)
        )
        conn.execute("PRAGMA journal_mode = DELETE")
    finally:
        conn.close()


def _remove_stale_journals(db_path: Path) -> None:
    for suffix in ("-wal", "-shm"):
        Path(f"{db_path}{suffix}").unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Replace the database with a backup file.")
    parser.add_argument("file", type=Path)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    try:
        run_restore(load_settings(), args.file)
    except RestoreError as exc:
        raise SystemExit(f"restore refused: {exc}") from exc
