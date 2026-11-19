import json
from pathlib import Path

import pytest

UUID = "0b7c2f4e-6a1d-4c3e-9f2a-1d2e3f4a5b6c"
OTHER_UUID = "5f0e9a7c-2b4d-4e8f-a1c3-7d6e5f4a3b2c"
FIXTURES = json.loads((Path(__file__).parents[2] / "fixtures" / "ops.cases.json").read_text())
SEED = FIXTURES["seed"]
CASES = FIXTURES["cases"]
DAY = {
    "bleeding": "light",
    "mucus_sensation": None,
    "mucus_features": None,
    "mucus_atypical": None,
    "mucus_quality_override": None,
    "symptoms": None,
    "intercourse": None,
    "disturbances": None,
    "chart_note": None,
    "mark_mucus": None,
    "notes": None,
}


def post_ops(client, ops):
    response = client.post("/api/sync", json={"ops": ops})
    assert response.status_code == 200
    return response.json()


def load(client, data):
    ops = []
    ops += [{"entity": "source", "key": k, "set": row} for k, row in data["sources"].items()]
    ops += [
        {"entity": "setting", "key": k, "set": {"value": v}} for k, v in data["settings"].items()
    ]
    ops += [{"entity": "cycle", "key": k, "set": row} for k, row in data["cycles"].items()]
    ops += [{"entity": "day", "key": k, "set": row} for k, row in data["days"].items()]
    ops += [{"entity": "temp", "key": k, "set": row} for k, row in data["temps"].items()]
    assert post_ops(client, ops)["rejected"] == []


def dataset(client):
    data = client.get("/api/data").json()
    data.pop("version")
    return data


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_ops_case(dev_client, case):
    start = {**SEED, **case.get("before", {})}
    load(dev_client, start)

    body = post_ops(dev_client, case["ops"])

    assert sorted(r["index"] for r in body["rejected"]) == case["rejected"]
    assert dataset(dev_client) == {**start, **case.get("after", {})}


def test_fully_rejected_batch_keeps_version(dev_client):
    version = dev_client.get("/api/data").json()["version"]

    body = post_ops(dev_client, [{"entity": "day", "key": "2026-13-01", "set": {"notes": "x"}}])

    assert body["version"] == version
    assert [r["index"] for r in body["rejected"]] == [0]


def test_applied_batch_changes_version(dev_client):
    version = dev_client.get("/api/data").json()["version"]

    body = post_ops(dev_client, [{"entity": "day", "key": "2026-11-18", "set": {"notes": "x"}}])

    assert body["version"] != version
    assert body["rejected"] == []


def test_rejection_message_names_field_not_value(dev_client):
    body = post_ops(
        dev_client, [{"entity": "day", "key": "2026-11-18", "set": {"bleeding": "heavy_flow"}}]
    )

    error = body["rejected"][0]["error"]
    assert error.startswith("bleeding")
    assert "heavy_flow" not in error


def test_history_has_one_row_per_update_or_delete(dev_client):
    post_ops(dev_client, [{"entity": "day", "key": "2026-11-18", "set": {"bleeding": "light"}}])
    post_ops(dev_client, [{"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}}])
    post_ops(dev_client, [{"entity": "day", "key": "2026-11-18", "delete": True}])
    post_ops(dev_client, [{"entity": "day", "key": "2026-11-18", "delete": True}])

    history = dev_client.get("/api/export.json").json()["history"]

    assert [(h["entity"], h["key"], h["device"]) for h in history] == [
        ("day", "2026-11-18", "dev"),
        ("day", "2026-11-18", "dev"),
    ]
    assert history[0]["snapshot"] == DAY


def test_history_snapshot_is_the_old_row_in_wire_format(dev_client):
    post_ops(
        dev_client, [{"entity": "day", "key": "2026-11-18", "set": {"mucus_features": ["clear"]}}]
    )
    post_ops(dev_client, [{"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}}])

    snapshot = dev_client.get("/api/export.json").json()["history"][0]["snapshot"]

    assert snapshot["mucus_features"] == ["clear"]
    assert set(snapshot) == set(DAY)


def test_etag_gives_304_until_the_data_changes(dev_client):
    first = dev_client.get("/api/data")
    etag = first.headers["etag"]
    assert etag == f'"{first.json()["version"]}"'

    unchanged = dev_client.get("/api/data", headers={"If-None-Match": etag})
    assert unchanged.status_code == 304
    assert unchanged.content == b""

    post_ops(dev_client, [{"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}}])

    changed = dev_client.get("/api/data", headers={"If-None-Match": etag})
    assert changed.status_code == 200
    assert changed.headers["etag"] != etag


def test_duplicate_start_date_names_the_field(dev_client):
    post_ops(dev_client, [{"entity": "cycle", "key": UUID, "set": {"start_date": "2026-11-01"}}])
    body = post_ops(
        dev_client,
        [{"entity": "cycle", "key": OTHER_UUID, "set": {"start_date": "2026-11-01"}}],
    )

    assert body["rejected"][0]["error"].startswith("start_date:")


def test_sync_body_must_have_ops(dev_client):
    response = dev_client.post("/api/sync", json={"ops": "nope"})

    assert response.status_code == 422
