import re


def test_export_is_a_download_with_dataset_and_history(dev_client):
    dev_client.post(
        "/api/sync",
        json={"ops": [{"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}}]},
    )
    dev_client.post(
        "/api/sync",
        json={"ops": [{"entity": "day", "key": "2026-11-18", "set": {"notes": "b"}}]},
    )

    response = dev_client.get("/api/export.json")

    assert response.status_code == 200
    assert re.fullmatch(
        r'attachment; filename="coverline-\d{4}-\d{2}-\d{2}\.json"',
        response.headers["content-disposition"],
    )
    body = response.json()
    assert set(body) == {"version", "sources", "cycles", "days", "temps", "settings", "history"}
    assert body["days"]["2026-11-18"]["notes"] == "b"
    assert len(body["history"]) == 1
    assert body["history"][0]["snapshot"]["notes"] == "a"


def test_export_needs_a_device(cf_client):
    assert cf_client.get("/api/export.json").status_code == 401
