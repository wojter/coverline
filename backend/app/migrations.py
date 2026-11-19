import json
import secrets
import sqlite3

from app.models import SETTING_DEFAULTS

SCHEMA_VERSION = 1

SCHEMA_V1 = (
    """
    CREATE TABLE sources (
      id         INTEGER PRIMARY KEY CHECK (id IN (1, 2)),
      name       TEXT    NOT NULL,
      site       TEXT    NOT NULL
        CHECK (site IN ('oral', 'vaginal', 'rectal', 'finger', 'wrist', 'other')),
      color      TEXT    NOT NULL
        CHECK (color GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
      marker     TEXT    NOT NULL CHECK (marker IN ('circle', 'square', 'triangle', 'diamond')),
      range_min  INTEGER NOT NULL,
      range_max  INTEGER NOT NULL CHECK (range_max > range_min),
      updated_at TEXT    NOT NULL
    ) STRICT
    """,
    """
    CREATE TABLE cycles (
      id                  TEXT    PRIMARY KEY,
      start_date          TEXT    NOT NULL UNIQUE CHECK (date(start_date) IS start_date),
      end_date            TEXT    CHECK (date(end_date) IS end_date),
      excluded_from_stats INTEGER NOT NULL DEFAULT 0 CHECK (excluded_from_stats IN (0, 1)),
      intention           TEXT    CHECK (intention IN ('avoid', 'conceive')),
      first_mucus_day     TEXT    CHECK (date(first_mucus_day) IS first_mucus_day),
      first_hf_mucus_day  TEXT    CHECK (date(first_hf_mucus_day) IS first_hf_mucus_day),
      coverline_1         INTEGER,
      coverline_2         INTEGER,
      fertile_start       TEXT    CHECK (date(fertile_start) IS fertile_start),
      fertile_end         TEXT    CHECK (date(fertile_end) IS fertile_end),
      prev_cycle_rise     INTEGER CHECK (prev_cycle_rise IN (0, 1)),
      notes               TEXT,
      updated_at          TEXT    NOT NULL,
      CHECK (end_date >= start_date),
      CHECK (fertile_end >= fertile_start)
    ) STRICT
    """,
    """
    CREATE TABLE days (
      date                   TEXT PRIMARY KEY CHECK (date(date) IS date),
      bleeding               TEXT
        CHECK (bleeding IN ('staining', 'spotting', 'light', 'medium', 'heavy')),
      mucus_sensation        TEXT CHECK (mucus_sensation IN ('dry', 'moist', 'wet')),
      mucus_features         TEXT CHECK (json_valid(mucus_features)),
      mucus_atypical         INTEGER CHECK (mucus_atypical IN (0, 1)),
      mucus_quality_override TEXT
        CHECK (mucus_quality_override IN ('none', 'less_fertile', 'highly_fertile')),
      symptoms               TEXT CHECK (json_valid(symptoms)),
      intercourse            TEXT CHECK (json_valid(intercourse)),
      disturbances           TEXT CHECK (json_valid(disturbances)),
      chart_note             TEXT CHECK (length(chart_note) <= 30),
      mark_mucus             TEXT CHECK (mark_mucus IN ('P', '1', '2', '3')),
      notes                  TEXT,
      updated_at             TEXT NOT NULL
    ) STRICT
    """,
    """
    CREATE TABLE temps (
      date       TEXT    NOT NULL CHECK (date(date) IS date),
      source_id  INTEGER NOT NULL REFERENCES sources(id),
      value      INTEGER NOT NULL,
      excluded   INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1)),
      mark       TEXT    CHECK (mark IN ('1', '2', '3', '4')),
      updated_at TEXT    NOT NULL,
      PRIMARY KEY (date, source_id),
      CHECK (excluded = 0 OR mark IS NULL)
    ) STRICT
    """,
    """
    CREATE TABLE settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL CHECK (json_valid(value))
    ) STRICT
    """,
    """
    CREATE TABLE history (
      id         INTEGER PRIMARY KEY,
      entity     TEXT NOT NULL,
      key        TEXT NOT NULL,
      snapshot   TEXT NOT NULL CHECK (json_valid(snapshot)),
      device     TEXT NOT NULL,
      changed_at TEXT NOT NULL
    ) STRICT
    """,
    """
    CREATE TABLE meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT
    """,
    """
    INSERT INTO sources (id, name, site, color, marker, range_min, range_max, updated_at)
    VALUES (1, '', 'oral', '#2563eb', 'circle', 3550, 3800, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
           (2, '', 'oral', '#d97706', 'square', 3550, 3800, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    """,
)


def migrate(conn: sqlite3.Connection) -> None:
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version == SCHEMA_VERSION:
        return
    if version != 0:
        raise RuntimeError(f"unknown schema version {version}")
    _create_v1(conn)


def _create_v1(conn: sqlite3.Connection) -> None:
    conn.execute("BEGIN IMMEDIATE")
    try:
        for statement in SCHEMA_V1:
            conn.execute(statement)
        for key, value in SETTING_DEFAULTS.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)", (key, json.dumps(value))
            )
        conn.execute(
            "INSERT INTO meta (key, value) VALUES ('data_version', ?)", (secrets.token_hex(6),)
        )
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
