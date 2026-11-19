import json
import logging
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.auth import Device, require_device
from app.db import Conn, utc_now
from app.models import OpError, blank_row, check_row, check_setting, parse_op, split_key

router = APIRouter(dependencies=[Depends(require_device)])
log = logging.getLogger("coverline")

BOOL_FIELDS = frozenset({"mucus_atypical", "excluded", "excluded_from_stats", "prev_cycle_rise"})
JSON_FIELDS = frozenset({"mucus_features", "symptoms", "intercourse", "disturbances"})


@dataclass(frozen=True)
class Table:
    name: str
    key_columns: tuple[str, ...]


TABLES = {
    "day": Table("days", ("date",)),
    "temp": Table("temps", ("date", "source_id")),
    "cycle": Table("cycles", ("id",)),
    "source": Table("sources", ("id",)),
}


class SyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ops: list[Any]


def data_version(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT value FROM meta WHERE key = 'data_version'").fetchone()
    return row["value"]


def read_dataset(conn: sqlite3.Connection) -> dict[str, Any]:
    return {
        "version": data_version(conn),
        "sources": {str(r["id"]): wire_row(r, ("id",)) for r in _all(conn, "sources")},
        "cycles": {r["id"]: wire_row(r, ("id",)) for r in _all(conn, "cycles")},
        "days": {r["date"]: wire_row(r, ("date",)) for r in _all(conn, "days")},
        "temps": {
            f"{r['date']}/{r['source_id']}": wire_row(r, ("date", "source_id"))
            for r in _all(conn, "temps")
        },
        "settings": {r["key"]: json.loads(r["value"]) for r in _all(conn, "settings")},
    }


def _all(conn: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return conn.execute(f"SELECT * FROM {table}").fetchall()


def wire_row(row: sqlite3.Row, key_columns: tuple[str, ...]) -> dict[str, Any]:
    values = {k: row[k] for k in row.keys() if k not in key_columns and k != "updated_at"}
    return {name: _from_db(name, value) for name, value in values.items()}


def _from_db(name: str, value: Any) -> Any:
    if value is None:
        return None
    if name in BOOL_FIELDS:
        return bool(value)
    if name in JSON_FIELDS:
        return json.loads(value)
    return value


def _to_db(name: str, value: Any) -> Any:
    if value is None:
        return None
    if name in BOOL_FIELDS:
        return int(value)
    if name in JSON_FIELDS:
        return json.dumps(value)
    return value


@router.get("/data")
def get_data(request: Request, conn: Conn) -> Response:
    etag = f'"{data_version(conn)}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})
    return JSONResponse(read_dataset(conn), headers={"ETag": etag})


@router.post("/sync")
def sync(body: SyncRequest, device: Device, conn: Conn) -> dict[str, Any]:
    applied, rejected = run_batch(conn, body.ops, device)
    version = data_version(conn)
    log.info("sync applied=%d rejected=%d version=%s", applied, len(rejected), version)
    return {"version": version, "rejected": rejected}


def run_batch(conn: sqlite3.Connection, ops: list[Any], device: str) -> tuple[int, list[dict]]:
    applied = 0
    rejected: list[dict] = []
    conn.execute("BEGIN IMMEDIATE")
    try:
        for index, raw in enumerate(ops):
            try:
                with savepoint(conn):
                    apply_op(conn, raw, device)
            except OpError as exc:
                rejected.append({"index": index, "error": str(exc)})
            except sqlite3.IntegrityError as exc:
                rejected.append({"index": index, "error": _constraint_message(exc)})
            else:
                applied += 1
        if applied:
            conn.execute(
                "UPDATE meta SET value = ? WHERE key = 'data_version'",
                (secrets.token_hex(6),),
            )
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    return applied, rejected


def _constraint_message(exc: sqlite3.IntegrityError) -> str:
    if "cycles.start_date" in str(exc):
        return "start_date: already used by another cycle"
    return "row violates a database constraint"


@contextmanager
def savepoint(conn: sqlite3.Connection) -> Iterator[None]:
    conn.execute("SAVEPOINT op")
    try:
        yield
    except BaseException:
        conn.execute("ROLLBACK TO op")
        conn.execute("RELEASE op")
        raise
    conn.execute("RELEASE op")


def apply_op(conn: sqlite3.Connection, raw: object, device: str) -> None:
    op = parse_op(raw)
    key = split_key(op.entity, op.key)
    if op.entity == "setting":
        _apply_setting(conn, op.key, op.set_fields["value"], device)
        return
    table = TABLES[op.entity]
    where = dict(zip(table.key_columns, key, strict=True))
    old = _read_row(conn, table, where)
    if op.delete:
        if old is not None:
            _snapshot(conn, op.entity, op.key, old, device)
            _delete_row(conn, table, where)
        return
    if old is None:
        row = {**blank_row(op.entity), **op.set_fields}
    else:
        row = {**old, **op.set_fields}
    check_row(op.entity, row)
    _check_ranges(conn, op.entity, key, row)
    if old is not None:
        _snapshot(conn, op.entity, op.key, old, device)
    _write_row(conn, table, where, row)


def _check_ranges(conn: sqlite3.Connection, entity: str, key: tuple, row: dict) -> None:
    if entity == "temp":
        _check_in_range(conn, key[1], "value", row["value"])
    if entity == "cycle":
        _check_in_range(conn, 1, "coverline_1", row["coverline_1"])
        _check_in_range(conn, 2, "coverline_2", row["coverline_2"])


def _check_in_range(conn: sqlite3.Connection, source_id: int, field: str, value: Any) -> None:
    if value is None:
        return
    source = conn.execute(
        "SELECT range_min, range_max FROM sources WHERE id = ?", (source_id,)
    ).fetchone()
    if not source["range_min"] <= value <= source["range_max"]:
        raise OpError(f"{field}: outside the range of source {source_id}")


def _read_row(conn: sqlite3.Connection, table: Table, where: dict) -> dict | None:
    row = conn.execute(
        f"SELECT * FROM {table.name} WHERE {_condition(where)}", tuple(where.values())
    ).fetchone()
    return None if row is None else wire_row(row, table.key_columns)


def _write_row(conn: sqlite3.Connection, table: Table, where: dict, row: dict) -> None:
    values = {**where, **{k: _to_db(k, v) for k, v in row.items()}, "updated_at": utc_now()}
    columns = ", ".join(values)
    placeholders = ", ".join(f":{column}" for column in values)
    updates = ", ".join(f"{c} = excluded.{c}" for c in values if c not in table.key_columns)
    conn.execute(
        f"INSERT INTO {table.name} ({columns}) VALUES ({placeholders}) "
        f"ON CONFLICT ({', '.join(table.key_columns)}) DO UPDATE SET {updates}",
        values,
    )


def _delete_row(conn: sqlite3.Connection, table: Table, where: dict) -> None:
    conn.execute(f"DELETE FROM {table.name} WHERE {_condition(where)}", tuple(where.values()))


def _condition(where: dict) -> str:
    return " AND ".join(f"{column} = ?" for column in where)


def _apply_setting(conn: sqlite3.Connection, key: str, value: Any, device: str) -> None:
    check_setting(key, value)
    old = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    if old is not None:
        _snapshot(conn, "setting", key, json.loads(old["value"]), device)
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        (key, json.dumps(value)),
    )


def _snapshot(conn: sqlite3.Connection, entity: str, key: str, old: Any, device: str) -> None:
    conn.execute(
        "INSERT INTO history (entity, key, snapshot, device, changed_at) VALUES (?, ?, ?, ?, ?)",
        (entity, key, json.dumps(old), device, utc_now()),
    )
