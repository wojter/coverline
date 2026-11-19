import json
import sqlite3
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.auth import require_device
from app.db import Conn
from app.sync import read_dataset

router = APIRouter(dependencies=[Depends(require_device)])


@router.get("/export.json")
def export(conn: Conn) -> JSONResponse:
    data: dict[str, Any] = read_dataset(conn)
    data["history"] = [_history_entry(r) for r in conn.execute("SELECT * FROM history ORDER BY id")]
    filename = f"coverline-{datetime.now(UTC):%Y-%m-%d}.json"
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _history_entry(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "entity": row["entity"],
        "key": row["key"],
        "snapshot": json.loads(row["snapshot"]),
        "device": row["device"],
        "changed_at": row["changed_at"],
    }
