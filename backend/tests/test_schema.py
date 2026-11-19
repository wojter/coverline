import sqlite3

import pytest

from app.db import connect, init_db


@pytest.fixture
def conn(tmp_path):
    path = tmp_path / "coverline.db"
    init_db(path)
    connection = connect(path)
    yield connection
    connection.close()


def test_schema_version_and_pragmas(conn):
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 1
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_every_table_is_strict(conn):
    tables = [t for t in conn.execute("PRAGMA table_list") if not t["name"].startswith("sqlite_")]

    assert {t["name"] for t in tables} == {
        "sources",
        "cycles",
        "days",
        "temps",
        "settings",
        "history",
        "meta",
    }
    assert all(t["strict"] == 1 for t in tables)


def test_seed_rows(conn):
    sources = conn.execute("SELECT id, name, color, range_min, range_max FROM sources").fetchall()
    settings = {r["key"]: r["value"] for r in conn.execute("SELECT * FROM settings")}
    version = conn.execute("SELECT value FROM meta WHERE key = 'data_version'").fetchone()[0]

    assert [tuple(s) for s in sources] == [
        (1, "", "#2563eb", 3550, 3800),
        (2, "", "#d97706", 3550, 3800),
    ]
    assert settings == {
        "default_intention": "null",
        "cycle_number_start": "1",
        "stats_n": "12",
    }
    assert len(version) == 12


def test_migration_is_not_repeated(tmp_path):
    path = tmp_path / "coverline.db"
    init_db(path)
    version = connect(path).execute("SELECT value FROM meta").fetchone()[0]

    init_db(path)

    assert connect(path).execute("SELECT value FROM meta").fetchone()[0] == version


VALID_DAY = "INSERT INTO days (date, updated_at) VALUES ('2026-11-18', 'x')"


def test_valid_rows_are_accepted(conn):
    conn.execute(VALID_DAY)
    conn.execute("INSERT INTO days (date, updated_at) VALUES ('2028-02-29', 'x')")
    conn.execute(
        "INSERT INTO days (date, chart_note, updated_at) VALUES ('2026-11-19', ?, 'x')", ("a" * 30,)
    )
    conn.execute(
        "INSERT INTO temps (date, source_id, value, excluded, updated_at) "
        "VALUES ('2026-11-18', 1, 3645, 1, 'x')"
    )


REJECTED_WRITES = [
    pytest.param(
        "INSERT INTO days (date, updated_at) VALUES ('2026-13-01', 'x')",
        id="month 13",
    ),
    pytest.param(
        "INSERT INTO days (date, updated_at) VALUES ('2026-5-10', 'x')",
        id="unpadded month",
    ),
    pytest.param(
        "INSERT INTO days (date, updated_at) VALUES ('2026-02-29', 'x')",
        id="no leap day in 2026",
    ),
    pytest.param(
        "INSERT INTO cycles (id, start_date, excluded_from_stats, updated_at) "
        "VALUES ('a', '2026-5-10', 0, 'x')",
        id="cycle start unpadded",
    ),
    pytest.param(
        "INSERT INTO cycles (id, start_date, end_date, excluded_from_stats, updated_at) "
        "VALUES ('a', '2026-11-05', '2026-11-01', 0, 'x')",
        id="cycle end before start",
    ),
    pytest.param(
        "INSERT INTO cycles (id, start_date, excluded_from_stats, updated_at) "
        "VALUES ('a', '2026-11-01', 2, 'x')",
        id="boolean not 0 or 1",
    ),
    pytest.param(
        "INSERT INTO days (date, bleeding, updated_at) VALUES ('2026-11-18', 'heavy_flow', 'x')",
        id="unknown code",
    ),
    pytest.param(
        "INSERT INTO days (date, mucus_features, updated_at) VALUES ('2026-11-18', 'clear', 'x')",
        id="array not json",
    ),
    pytest.param(
        "INSERT INTO days (date, chart_note, updated_at) VALUES ('2026-11-18', ?, 'x')",
        id="chart note over 30",
    ),
    pytest.param(
        "INSERT INTO days (date, mark_mucus, updated_at) VALUES ('2026-11-18', '4', 'x')",
        id="mucus mark out of set",
    ),
    pytest.param(
        "INSERT INTO temps (date, source_id, value, excluded, mark, updated_at) "
        "VALUES ('2026-11-18', 1, 3645, 1, '1', 'x')",
        id="excluded reading with mark",
    ),
    pytest.param(
        "INSERT INTO temps (date, source_id, value, updated_at) "
        "VALUES ('2026-11-18', 3, 3645, 'x')",
        id="unknown source",
    ),
    pytest.param(
        "INSERT INTO sources (id, name, site, color, marker, range_min, range_max, updated_at) "
        "VALUES (3, '', 'oral', '#2563eb', 'circle', 3550, 3800, 'x')",
        id="third source",
    ),
    pytest.param(
        "UPDATE sources SET color = '#ABCDEF' WHERE id = 1",
        id="uppercase colour",
    ),
    pytest.param(
        "UPDATE sources SET range_min = 3800 WHERE id = 1",
        id="empty range",
    ),
    pytest.param(
        "INSERT INTO settings (key, value) VALUES ('stats_n', 'not json')",
        id="setting not json",
    ),
]


@pytest.mark.parametrize("sql", REJECTED_WRITES)
def test_schema_rejects(conn, sql):
    params = ("a" * 31,) if "?" in sql else ()
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(sql, params)
