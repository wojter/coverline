import sqlite3

import pytest

from app.backup import KEEP, run_backup
from app.db import init_db


@pytest.fixture
def settings(dev_settings):
    init_db(dev_settings.db_path)
    return dev_settings


def test_backup_writes_a_readable_copy(settings, dev_client):
    dev_client.post(
        "/api/sync",
        json={"ops": [{"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}}]},
    )

    target = run_backup(settings)

    assert target.parent == settings.data_dir / "backup"
    copy = sqlite3.connect(target)
    try:
        assert copy.execute("SELECT notes FROM days").fetchone() == ("a",)
    finally:
        copy.close()


def test_backup_keeps_only_the_newest_copies(settings):
    directory = settings.data_dir / "backup"
    directory.mkdir(parents=True)
    names = [f"coverline-20200101T0000{i:02d}Z.db" for i in range(KEEP + 1)]
    for name in names:
        (directory / name).write_bytes(b"old")

    run_backup(settings)

    kept = sorted(p.name for p in directory.glob("coverline-*.db"))
    assert len(kept) == KEEP
    assert names[0] not in kept
    assert names[-1] in kept


def test_backup_needs_a_database(dev_settings):
    with pytest.raises(FileNotFoundError):
        run_backup(dev_settings)
