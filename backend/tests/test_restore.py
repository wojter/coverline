import pytest

from app.backup import run_backup
from app.restore import RestoreError, run_restore

DAY = "2026-11-18"


def write_notes(client, notes):
    response = client.post(
        "/api/sync",
        json={"ops": [{"entity": "day", "key": DAY, "set": {"notes": notes}}]},
    )
    assert response.json()["rejected"] == []


def notes_and_version(client):
    data = client.get("/api/data").json()
    return data["days"][DAY]["notes"], data["version"]


def test_restore_roundtrip(dev_settings, dev_client):
    write_notes(dev_client, "before backup")
    backup = run_backup(dev_settings)
    backed_up_version = dev_client.get("/api/data").json()["version"]
    write_notes(dev_client, "after backup")

    run_restore(dev_settings, backup)

    notes, version = notes_and_version(dev_client)
    assert notes == "before backup"
    assert version != backed_up_version


def test_restore_refuses_a_corrupt_file(dev_settings, dev_client, tmp_path):
    write_notes(dev_client, "keep me")
    corrupt = tmp_path / "coverline-corrupt.db"
    corrupt.write_bytes(b"this is not a database" * 500)

    with pytest.raises(RestoreError):
        run_restore(dev_settings, corrupt)

    assert notes_and_version(dev_client)[0] == "keep me"


def test_restore_refuses_a_missing_file(dev_settings, dev_client, tmp_path):
    with pytest.raises(RestoreError, match="not found"):
        run_restore(dev_settings, tmp_path / "missing.db")
