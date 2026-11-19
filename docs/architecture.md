# Coverline – Architecture (PoC)

- **What** the app does is defined in `docs/functional-spec.md`. It wins every conflict. Never edit it.
- **Why** each choice was made is recorded in `docs/decisions.md`.
- This file defines **how** the app is built.

## 1. Overview

```
phone / PC (installed PWA)                    home server (docker compose, no published ports)
┌──────────────────────────────┐              ┌───────────────────────────────────────┐
│ Preact UI (F1–F6)            │    HTTPS     │ cloudflared  (outbound tunnel only)   │
│ domain/  pure TS logic       │◀── Cloud- ──▶│ app: FastAPI                          │
│ data/    IndexedDB + outbox  │    flare     │   /api/*  and the static PWA build    │
│ Service Worker (shell only)  │   Access     │   SQLite (WAL) in /data               │
└──────────────────────────────┘              └───────────────────────────────────────┘
```

1. The client holds the **whole dataset** in IndexedDB and works offline by default.
2. All domain logic (cycles, derived values, marks, stats, CSV) lives **only** in `frontend/src/domain/`.
3. The server validates, stores, snapshots history, serves sync and export, and is backed up. It computes no domain values.
4. The Service Worker caches only the app shell, never API responses.

## 2. Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, uvicorn, Pydantic v2, stdlib `sqlite3`, PyJWT[crypto] |
| Frontend | Preact, TypeScript, Vite, `preact-iso`, `@preact/signals` |
| UI | Tailwind v4, daisyUI 5 (light/dark theme), `lucide-preact`, hand-written SVG charts |
| PWA | `vite-plugin-pwa` (generateSW, `registerType: 'prompt'`, `injectRegister: null`, `useRegisterSW` from `virtual:pwa-register/preact`, see D14) |
| Storage | `idb-keyval` |
| i18n | Own `t()` over `en.json` / `pl.json`, `Intl` for dates and numbers |
| Tests | pytest + httpx, vitest, optional Playwright e2e |
| Deploy | Docker multi-stage (Node build → Python slim), docker compose, `cloudflared` |

## 3. Network and auth

Cloudflare setup (steps in `docs/cloudflare.md`):
- Tunnel: public hostname `coverline.<domain>` → `http://app:8000`.
- Access app **API** on `coverline.<domain>/api`: policy **Service Auth**, include only the device tokens.
- Access app **Shell** on `coverline.<domain>`: policy **Bypass**. It serves only static files, never data.
- Turn on **strict service token auth**.
- Create one service token per device (`coverline-ios`, `coverline-android`, `coverline-pc`). Give each a 1-year duration and an expiration alert.

Backend (`AUTH_MODE=cloudflare`):
1. Read `Cf-Access-Jwt-Assertion` and verify it: RS256, JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (cached), `aud` = AUD of the API app, `iss` = team domain.
2. Require `common_name` to be listed in `ALLOWED_SERVICE_TOKENS` (format: `<client_id>=<label>,...`).
3. The identity is that label (for example `ios`). F6 shows it in place of "logged-in email".
4. If any check fails, return 401.

`AUTH_MODE=dev` uses `DEV_IDENTITY`. The app refuses to start in this mode unless `ENV=dev`.

Client:
- The user pastes the token once in **Settings / Connect** as `<client_id>:<client_secret>`. On iOS this must be done inside the installed app, not in Safari.
- The token is stored in IndexedDB. It is sent as `CF-Access-Client-Id` and `CF-Access-Client-Secret` on `/api/*` fetches only.
- The UI shows only the last 4 characters of the token.
- Without a token, the app works locally and shows "not connected".

## 4. Data (SQLite)

WAL mode, `foreign_keys=ON`, migrations keyed by `PRAGMA user_version`. All tables are `STRICT`. Enum values use the codes from spec 2.4.

```sql
CREATE TABLE sources (
  id         INTEGER PRIMARY KEY CHECK (id IN (1, 2)),   -- seeded with name '' (D15)
  name       TEXT    NOT NULL,
  site       TEXT    NOT NULL,
  color      TEXT    NOT NULL,
  marker     TEXT    NOT NULL,
  range_min  INTEGER NOT NULL,
  range_max  INTEGER NOT NULL CHECK (range_max > range_min),
  updated_at TEXT    NOT NULL
) STRICT;

CREATE TABLE cycles (
  id                  TEXT    PRIMARY KEY,               -- crypto.randomUUID(), never changes
  start_date          TEXT    NOT NULL UNIQUE,
  end_date            TEXT    CHECK (end_date >= start_date),
  excluded_from_stats INTEGER NOT NULL DEFAULT 0,
  intention           TEXT,
  first_mucus_day     TEXT,
  first_hf_mucus_day  TEXT,
  coverline_1         INTEGER,
  coverline_2         INTEGER,
  fertile_start       TEXT,
  fertile_end         TEXT    CHECK (fertile_end >= fertile_start),
  prev_cycle_rise     INTEGER,
  notes               TEXT,
  updated_at          TEXT    NOT NULL
) STRICT;

CREATE TABLE days (
  date                   TEXT PRIMARY KEY,
  bleeding               TEXT,
  mucus_sensation        TEXT,
  mucus_features         TEXT,                           -- JSON array of codes
  mucus_atypical         INTEGER,
  mucus_quality_override TEXT,
  symptoms               TEXT,                           -- JSON array of codes
  intercourse            TEXT,                           -- JSON array of codes
  disturbances           TEXT,                           -- JSON array of codes
  chart_note             TEXT CHECK (length(chart_note) <= 30),
  mark_mucus             TEXT,
  notes                  TEXT,
  updated_at             TEXT NOT NULL
) STRICT;

CREATE TABLE temps (
  date       TEXT    NOT NULL,
  source_id  INTEGER NOT NULL REFERENCES sources(id),
  value      INTEGER NOT NULL,
  excluded   INTEGER NOT NULL DEFAULT 0,
  mark       TEXT,
  updated_at TEXT    NOT NULL,
  PRIMARY KEY (date, source_id),
  CHECK (excluded = 0 OR mark IS NULL)
) STRICT;

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK (json_valid(value))) STRICT;
CREATE TABLE history  (id INTEGER PRIMARY KEY, entity TEXT NOT NULL, key TEXT NOT NULL,
                       snapshot TEXT NOT NULL, device TEXT NOT NULL, changed_at TEXT NOT NULL) STRICT;
CREATE TABLE meta     (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;   -- data_version
```

Column checks, left out above for readability but present on every matching column:
- Dates (`date`, `*_date`, `*_day`, `fertile_*`): `CHECK (date(x) IS x)`. Do not use `x = date(x)`: it lets `2026-13-01` and `2026-5-10` through, because the comparison with `NULL` passes the check.
- Booleans (`excluded`, `excluded_from_stats`, `mucus_atypical`, `prev_cycle_rise`): `CHECK (x IN (0, 1))`.
- Enums (`site`, `marker`, `bleeding`, `mucus_sensation`, `mucus_quality_override`, `intention`, `mark_mucus` P/1/2/3, `temps.mark` 1/2/3/4): `CHECK (x IN (...))` with the codes from spec 2.4.
- JSON arrays: `CHECK (json_valid(x))`. The server also checks the codes inside.

Rules:
- Temperatures are stored as integer hundredths of a degree (`3645` = 36.45 °C): `value`, `coverline_1`, `coverline_2`, `range_min`, `range_max`.
- JSON columns are `TEXT`. SQLite has no JSON type: a column declared `JSON` gets NUMERIC affinity, so `'12'` comes back as the integer 12.
- `updated_at` and `changed_at` are UTC ISO 8601, set by the server. They are informational only. Sync does not use them.
- **Cycles** (spec 2.5):
  - `id` is generated by the client when the cycle is created and never changes. Ops refer to a cycle by id, so an edit made offline still lands on the right cycle after its start was moved on another device.
  - Moving a start is one op that sets `start_date`. `days` and `temps` are keyed by date, not by cycle, so nothing else is rewritten.
  - The client derives the cycle of each date. A cycle ends on the earlier of `end_date` and the day before the next `start_date`. Overlaps therefore cannot occur, and the server needs no cross-row check beyond `UNIQUE (start_date)`.
  - Removing a cycle start deletes the row.
  - `prev_cycle_rise = NULL` means "use the computed value". `first_mucus_day` or `first_hf_mucus_day = NULL` means "not confirmed yet", and the UI shows the suggestion. `intention` is written when the cycle is created.
- **A `temps` row exists only when there was a reading.** Clearing a temperature in F1 or F2 (the clear button next to each source) deletes the row, and its mark goes with it. This fixes a reading entered on a day when nothing was measured.
- Excluding a reading must clear its mark in the same op. The `CHECK` rejects it otherwise.
- `mucus_quality` is not stored. Only `mucus_quality_override` is stored, and the client derives the value.
- Every update or delete first copies the old row into `history`, with the device label, in the same transaction.
- Every successful write sets `meta.data_version` to a new random value. It is used as the ETag.

## 5. API (`/api`, all require auth except `/health`)

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `ok` (used by the docker healthcheck) |
| GET | `/me` | `{device}` |
| GET | `/data` | Full dataset. Supports `If-None-Match`, so an unchanged dataset gets `304`. |
| POST | `/sync` | Applies ops. Returns `{version, rejected: [{index, error}]}`. |
| GET | `/export.json` | Full dataset plus history, as a download |

An op is one change to one row, identified by `entity` and `key`. It either sets some fields (`set`) or deletes the row (`delete: true`):

```json
{ "entity": "day",   "key": "2026-11-18",   "set": { "bleeding": "light", "chart_note": null } }
{ "entity": "temp",  "key": "2026-11-18/1", "delete": true }
{ "entity": "cycle", "key": "0b7c2f4e-…",   "set": { "start_date": "2026-11-19" } }
```

- Entities: `day`, `temp`, `cycle`, `source`, `setting`. Keys are strings. A cycle's key is its id.
- Fields not listed in `set` are kept. A field set to `null` is cleared.
- Valid ops are applied in order, in one transaction. Invalid ops are skipped and listed in `rejected`.
- Each op runs in its own savepoint, so an op that fails a database constraint (for example a duplicate `start_date`) is rejected alone.
- The server checks codes, dates, `chart_note` length (30 characters or fewer), mark values, that a reading or coverline is within its source's range, and the single-row rules in section 4 (checked on the merged row).
- The client enforces the cross-row rules: mark uniqueness per cycle and the cycle boundary rules of spec 2.5.
- A change that touches several rows is sent as several ops in one request. Examples: moving a mark, or splitting a cycle that has an `end_date`.

## 6. Client data and sync

IndexedDB holds four keys: `data` (the whole dataset), `outbox` (pending ops), `failed` (rejected ops) and `meta` (token, ETag, local schema version, language, theme; see D16).

1. **Save:** apply the op to `data` in memory, then write `data` and `outbox` together with `setMany`. Update the signals and start a sync. The UI shows "saved locally", then "synced".
2. **Sync:**
   - `POST /sync` with the outbox. On 200, remove the sent ops and move rejected ones to `failed`. F6 lists failed ops so the user can retry or discard them.
   - Then `GET /data` with the ETag. On 200, `data` becomes the server dataset, with the remaining outbox ops re-applied on top.
3. **Errors:**
   - Network error or 5xx: retry with backoff.
   - 401, 403 or `opaqueredirect` (fetch with `redirect: 'manual'`): show a "token invalid or expired" banner and keep the outbox.
4. **Triggers:** app start, after a save, the `online` event, `visibilitychange` to visible, and the manual button in F6.
5. **Conflicts:** last write wins per field. Unsent local edits win over server data. Retrying an op that was already applied is harmless. Cross-row results of a merge (a mark used twice in a cycle, a cycle date outside its cycle) are shown as warnings (spec 2.1, 2.5), never fixed silently.
6. **Local schema:** on start, run migrations on `meta.schema`.
7. **App updates:** show an "update available" toast and reload only when the user taps it, never while a form has unsaved input.
8. **Storage:** call `navigator.storage.persist()` on first run and show the result in F6.
9. **Today:** the device's local date.

## 7. Code layout

```
backend/app/   main.py (static files, SPA fallback, headers), auth.py, db.py, migrations.py,
               models.py (Pydantic ops, enums), sync.py, export.py, backup.py, restore.py
backend/tests/
frontend/src/  domain/      cycles, derive, marks, stats, tempInput, csv   (+ *.test.ts)
               data/        db, sync, store (signals)
               i18n/        en.json, pl.json, index.ts
               components/  Chips, TempInput, CycleRing, SyncBadge, chart/
               views/       Today, Entry, Chart, Calendar, Stats, Settings  (lazy)
compose.yaml, Dockerfile
```

UI rules not in the spec:
- Routes: `/`, `/wpis/:date`, `/karta/:date` (normalised to the cycle start), `/kalendarz`, `/statystyki`, `/ustawienia`.
- Inputs at 16 px or larger. Temperature fields use `inputmode="decimal"`.
- Print uses `@page { size: A4 landscape }`, with one SVG chart sized to the page.

## 8. Security and logging

- Headers on every response:
  - CSP `default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
- `/api/*` also gets `Cache-Control: no-store`.
- Never render `style="..."` strings. Preact's CSSOM styles are allowed by the CSP.
- Logs contain events only:
  - request method, path, status and duration
  - auth result with the device label (`token accepted: ios`, `token rejected: unknown client id`)
  - sync summary (ops applied and rejected, new version)
  - validation errors by field name only
- Logs **never** contain request or response bodies, field values, notes, the token or the JWT.
- No third-party requests, CDNs or analytics.

## 9. Deployment and operations

- `compose.yaml` runs two services:
  - `app`: volume `./data:/data`, healthcheck on `/api/health`
  - `cloudflared`: reads `TUNNEL_TOKEN` from `.env`
- No `ports:`. If a host port is ever needed, use `127.0.0.1:8000:8000` only. A plain `8000:8000` bypasses UFW and opens the port to the LAN.
- Static caching: `/assets/*` gets `immutable`. `index.html`, `sw.js` and the manifest get `no-cache`.
- **Backup:** a host systemd timer runs `docker compose exec app python -m app.backup` daily. It writes a SQLite `.backup()` to `/data/backup` and keeps 30 copies. Then `restic` copies `/data/backup` to R2 or B2, encrypted.
- **Restore:**
  1. `docker compose stop app`
  2. `docker compose run --rm app python -m app.restore <file>` (runs `integrity_check`, then swaps the file)
  3. `docker compose start app`
  - Clients pick up the restored data on their next sync and re-apply their unsent ops.
- **Local dev:**
  - Run `ENV=dev AUTH_MODE=dev` with `vite dev` and `uvicorn` on localhost, using `./data-dev`, never the production DB.
  - `localhost` is a secure context, so the Service Worker works there.
  - Android phone: `adb reverse tcp:5173 tcp:5173`. iOS: use the tunnel URL.
  - Never add a "trust localhost" rule.

## 10. Spikes (verify first, on both phones)

- **S1 Auth:**
  - `/` loads without a login, and `/api/*` without the token headers returns 401 or 403.
  - Paste the token, sync, go offline and come back. Then revoke the token and check that the banner appears.
- **S2 Storage:** data in the installed app survives several days without the app being opened (iOS and Android).
- **S3 Print:** a full cycle fits one A4 landscape page and is readable in black and white.
