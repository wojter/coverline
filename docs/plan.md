# Coverline – Implementation Plan (PoC)

> Execution order for agents. Source-of-truth order, highest first: `functional-spec.md` (what, wins every conflict, never edit),
> `architecture.md` (how), `decisions.md` (why), this plan (order and split of work).
> If this plan contradicts them, they win: stop and report the conflict.
> Refs: `S` = functional-spec, `A` = architecture, `D` = decisions. Choices made for this plan are D14–D18.

## Rules for every task

1. Read the referenced sections before writing code.
2. Touch only the files listed in the task, plus their tests. If another file is needed, say so in the report.
3. Done = the task's **Done when** holds and `make check` is green.
4. No domain logic in the backend (D2). No hardcoded UI strings (S4.4). No `style="..."` strings (A8). Logs carry no field values (A8). No third-party requests.
5. Temperatures are integer hundredths everywhere (DB, wire, IndexedDB, domain). Conversion happens only in `tempInput.ts` and the UI.
6. A new architectural choice is appended to `decisions.md` as `Dn` with status **proposed**, and the task stops for review.
7. One commit per task: `<task id>: <summary>`.
8. UI tasks (1.3, U*): follow the style of the reference apps, never their features (D19).

## Dependency graph

```
0.1 → 0.2 ─┬→ 1.1 → 1.2 ─┐
           ├→ 1.3 ───────┴→ 1.4 (gate: spikes S1–S3)
           ├→ A1 → A2 → A3 ; A4                       (backend)
           ├→ B1 → {B2, B3, B4} → B5 → {B6, B7} → B8  (domain)
           └→ C1 ; B1 → C2                            (i18n, client data)
1.4 + B* + C* → U1 → {U2 … U7} → V1 … V4
```

Tasks inside `{}` run in parallel (disjoint files).

---

## Phase 0 – Foundations (sequential)

### 0.1 Repo scaffold
- Files: `.gitignore`, `AGENTS.md`, `Makefile`, `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/tests/conftest.py`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`
- Do: pin the stack from A2 (D18). `Makefile` targets: `check` (ruff + pytest + `tsc --noEmit` + `vitest run` + `vite build`), `dev-api`, `dev-web` (A9 local dev, `./data-dev`). `.gitignore`: `data/`, `data-dev/`, `.env`, `node_modules/`, `dist/`.
- Done when: `make check` passes on empty suites. `AGENTS.md` holds the rules above and the commands.

### 0.2 Wire contract (blocks everything after it)
- Files: `docs/architecture.md` (new §5.1 "Wire format"), `fixtures/dataset.sample.json`, `fixtures/ops.cases.json`
- Refs: A4, A5, A6, S2.4
- Do:
  - `GET /data` shape: `{version, sources: {"1": …}, cycles: {<id>: …}, days: {<date>: …}, temps: {"<date>/<s>": …}, settings: {<key>: <json>}}`. Maps are keyed by the op key, so an op applies as `data[entity][key]`.
  - Booleans as JSON booleans, multi-selects as JSON arrays in S2.4 code order, temperatures in hundredths, dates `YYYY-MM-DD`.
  - Setting keys: `default_intention`, `cycle_number_start` (default 1), `stats_n` (default 12). Language is per device (D16).
  - `ops.cases.json`: `{before, ops, after, rejected}` cases for: partial set, `null` clears, upsert, delete, delete of a missing row (no-op, not rejected), exclude with mark (rejected), out-of-range reading and coverline, `chart_note` of 31 characters, `2026-13-01` and `2026-5-10`, duplicate `start_date`, unknown code in a JSON array.
- Done when: both fixtures are reviewed. They are run by A2 (pytest) and C2 (vitest), so server and client merge identically.

## Phase 1 – Walking skeleton and spikes

### 1.1 Backend skeleton
- Files: `backend/app/main.py`, `auth.py`, `db.py`, `migrations.py`, `backend/tests/test_auth.py`, `test_schema.py`, `test_http.py`
- Refs: A3, A4, A7, A8, D9, D12
- Do:
  - `migrations.py`: full schema v1 from A4 with every column `CHECK`, `STRICT`, WAL, `foreign_keys=ON`, `PRAGMA user_version`. Seed sources 1 and 2 (D15, D18), settings defaults (D18), `meta.data_version`.
  - `db.py`: one connection per request, one uvicorn worker.
  - `auth.py`: `PyJWKClient` (cached), RS256, `aud`, `iss`, `common_name` in `ALLOWED_SERVICE_TOKENS` → device label. `AUTH_MODE=dev` refuses to start unless `ENV=dev`.
  - `main.py`: `/api/health`, `/api/me`, security and cache headers, static files with SPA fallback (never for `/api/*`), event-only logging.
- Done when: tests sign JWTs with a test RSA key: valid → 200 with label; wrong `aud`/`iss`, unknown client, missing header → 401. Dev mode without `ENV=dev` fails to start. Schema rejects `2026-13-01`, `2026-5-10`, excluded reading with mark. `/api/nope` → JSON 404. Headers present.

### 1.2 Deploy skeleton
- Files: `Dockerfile`, `compose.yaml`, `.env.example`, `docs/cloudflare.md` (referenced by A3, missing)
- Refs: A3, A9
- Do: multi-stage build (Node → Python slim), services `app` + `cloudflared`, no `ports:`, healthcheck on `/api/health`, volume `./data:/data`. `cloudflare.md` = step-by-step for the tunnel, both Access apps, strict service auth, 3 tokens with expiry alerts.
- Done when: `docker compose up` is healthy. Through the tunnel: `/` → 200, `/api/me` without token → 401/403.

### 1.3 Frontend shell
- Files: `frontend/vite.config.ts`, `src/main.tsx`, `src/app.tsx`, `src/styles.css`, `src/data/db.ts`, `src/data/sync.ts` (fetch wrapper only), `src/components/UpdateToast.tsx`, `src/views/{Today,Entry,Chart,Calendar,Stats,Settings}.tsx` (placeholders)
- Refs: A2, A6.7–6.8, A7, D14
- Do: `vite-plugin-pwa` with `registerType: 'prompt'`, `injectRegister: null`, `useRegisterSW` in `UpdateToast` (D14), `navigateFallbackDenylist: [/^\/api\//]`, no runtime caching. Tailwind v4 + daisyUI 5 with the themes and domain colour tokens, and the app frame (dock, top tabs on `≥ lg`). `preact-iso` with the 6 lazy routes. `db.ts`: keys `data`, `outbox`, `failed`, `meta`; `navigator.storage.persist()`. Minimal Connect form in Settings: paste `<client_id>:<client_secret>`, show last 4 chars, call `/api/me` with `redirect: 'manual'`.
- Done when: production build installs as a PWA, works offline, shows the device label after connecting, and has no CSP violations in the console.

### 1.4 Gate: spikes S1–S3 (manual, user, both phones)
- Files: `spikes/print/` (throwaway), `docs/decisions.md` (results)
- Do: S1 and S2 on the deployed skeleton (A10). S3: static SVG with all 11 rows (S F3) at 40 and 60 columns, printed A4 landscape in black and white.
- Done when: results recorded as `Dn`. S1 fail → Tailscale fallback (D4). S2 fail → stop and revisit D1. S3 fixes the chart sizing constants used by U4.

## Phase 2 – Core (three parallel tracks)

### Track A – Backend (after 0.2, 1.1)

**A1 `models.py`** – enums from S2.4; Pydantic op models per entity with the allowed `set` fields; key formats (date, `date/1|2`, uuid, `1|2`, setting keys); `chart_note` ≤ 30 code points (D17), colour `#rrggbb` (D18); mark values; code arrays. Done when: unit tests for each entity accept valid and reject invalid ops.

**A2 `sync.py`** – Refs: A4 rules, A5, D6, D7, D13.
- `POST /api/sync`: one transaction, one savepoint per op. Merge onto the existing row, then validate the merged row (range from `sources`, excluded vs mark). Copy the old row to `history` with the device label before every update or delete. Bump `data_version` only if at least one op applied.
- `GET /api/data`: ETag = `data_version`, `If-None-Match` → 304.
- Done when: every case in `fixtures/ops.cases.json` passes. History has one row per update/delete. A fully rejected batch keeps the version.

**A3 `export.py`** – `/api/export.json`: full dataset plus history, `Content-Disposition: attachment`. Done when: tested.

**A4 `backup.py`, `restore.py`, `ops/`** – `.backup()` to `/data/backup`, keep 30. Restore: `integrity_check`, atomic swap, then a new random `data_version`. `ops/coverline-backup.{service,timer}`, `ops/restic.sh`. Done when: backup → restore roundtrip test; a corrupt file is refused.

### Track B – Domain (after 0.2), `frontend/src/domain/*.ts` + `*.test.ts`

Pure functions only. No imports from `data/`, `components/`, `views/`. Boundary changes return op lists and never mutate.

**B1 `types.ts`, `dates.ts`** – types mirroring 0.2; S2.4 codes as `const` arrays; date math on `YYYY-MM-DD` strings in UTC (no DST bugs); `today()` = device local date (A6.9).

**B2 `tempInput.ts`** – S F1 fast input (`645` → 3645, `3645` → 3645, `,` and `.`); per-source range; default ranges by site (S2.1); locale formatting.

**B3 `derive.ts`** – mucus quality (S4.2) with override; last day of menstruation; first mucus / first highly fertile mucus suggestions; computed previous cycle rise.

**B4 `cycles.ts`** – Refs: S2.3, S2.5, D11.
- Cycle ranges (end = earlier of `end_date` and next start − 1), `cycleOf(date)`, cycle day, number (D17), length, open/completed, days outside any cycle.
- Op builders: check Cycle day 1 (days 2–7 → move or new; else split with `end_date` takeover), uncheck (move or remove, join to previous, `end_date` takeover), move start (never onto or past a neighbour), set `end_date`.
- Flags for 2.2 dates outside their cycle.

**B5 `marks.ts`** – assign/remove → ops (a used value moves within the cycle); clear the mark when a reading is excluded or cleared; warnings for duplicates (earliest wins) and non-ascending order; `mucus_peak`, peak +3, `third_high_day[s]`, luteal length `[s]` (S2.3, S6.3).

**B6 `stats.ts`** – S2.3, S F5: average/min/max (overall and last N), shortest/longest of last N before the viewed cycle with the count used, −21/−20, F1 ring average, per-cycle table, source evaluation (D17: completed, non-excluded cycles only). Excluded cycles and out-of-cycle days never count.

**B7 `csv.ts`** – S4.4: PL (`;`, decimal comma, PL headers) and EN (`,`, point, EN headers), UTF-8 with BOM, multi-selects as 0/1 columns, source names in headers. One row per recorded day, sorted by date, with cycle number, cycle day and derived mucus quality.

**B8 Acceptance fixtures** – `domain/__fixtures__/cycles3.ts`, `domain/acceptance.test.ts`: 3 sample cycles (one with an `end_date` gap, one excluded) with expected length, shortest/longest, −20/−21, +3, luteal length. Done when: the **user** confirms the expected values by hand (S7).

### Track C – i18n and client data

**C1 i18n** (after 0.2) – `i18n/index.ts` (`t()` with interpolation, `Intl` dates and numbers, browser detection `pl`/else `en`, per-device choice in `meta`, D16), `en.json`, `pl.json` pre-filled with every label from S2.1–S2.4, S3, S4.3. Owns these files: view tasks may only add keys under `<view>.*`. Done when: a test enforces key parity and no empty values.

**C2 data layer** (after B1) – Refs: A6, D6, D7, D8.
- `data/apply.ts`: pure `applyOp`, same semantics as the server; runs `fixtures/ops.cases.json`.
- `data/store.ts`: signals (`data`, `outbox`, `failed`, `syncState`, derived cycles); `save(ops)` = apply + `setMany` of `data` and `outbox` + start sync.
- `data/sync.ts`: POST outbox → drop sent, rejected → `failed`; GET with ETag → replace and re-apply the outbox; backoff on network/5xx; 401/403/`opaqueredirect` → banner, keep outbox; all triggers from A6.4.
- `data/db.ts`: local schema migrations on `meta.schema`.
- Done when: vitest with mocked fetch covers offline save → online → synced, rejected → failed, 401 keeps the outbox, the 304 path.

## Phase 3 – UI (after 1.4, B*, C*)

**U1 shared components** – `components/`: `Chips` (single/multi), `TempInput` (`inputmode="decimal"`, ≥ 16 px, clear button that deletes the reading, D8), `CycleRing`, `SyncBadge`, `TokenBanner`, `MucusInfo` (S4.3), `Day1Prompt` (S2.5 dialogs). Then U2–U7 run in parallel, one agent per view.

**U2 F2 Entry** `/entry/:date` – all S2.1 fields, chips only, override marker and reset, mark chips, prev/next day. Save sends only touched fields; an explicit clear sends `null` (S4.1). Build this view first: it exercises every field.

**U3 F1 Today** `/` – ring, intention, quick form, partial fill with prefill, save with sync status. Keyboard "next" moves from source 1 to source 2, Save visible without scrolling (20 s target, S4.1).

**U4 F3 Chart** `/chart/:date` – split in three:
- U4a `components/chart/layout.ts` + tests (pure geometry: shared scale 36.00–37.30 auto-extended, 0.05 steps, ≥ 40 columns, line breaks on missing days, skips excluded readings) and `Chart.tsx` (rows 1–11 in card order, colour + marker shape, marks above points, disturbance markers, rotated `chart_note` anchored to the top with ellipsis, behind the curves).
- U4b `views/Chart.tsx`: summary panel with flags, interpretation editor (coverline typed or tapped, fertile days, count-mark mode), source toggles, tap → `/entry/:date`, cycle navigation and list, URL normalised to the cycle start.
- U4c print: `@page { size: A4 landscape }`, one page, legend, mucus definitions, B/W legible, constants from S3.

**U5 F4 Calendar** `/calendar` – month grid (Monday first), day indicators, muted out-of-cycle days, "Mark cycle starts" mode using `Day1Prompt`.

**U6 F5 Stats** `/stats` – cycle totals, per-cycle table (tap → chart), source evaluation side by side, excluded cycles marked.

**U7 F6 Settings** `/settings` – sources (name, site, colour, marker, range), language, cycle settings, CSV download via `csv.ts`, JSON via `fetch` + `Blob` of `/api/export.json` (a plain link cannot carry the token headers), outbox and failed ops (retry/discard), manual sync, device label, storage persistence status, token.

## Phase 4 – Hardening and acceptance

**V1 e2e** (Playwright, `frontend/e2e/`) – partial save twice loses nothing; offline entry syncs on reconnect; moving a start in both directions keeps the data and an old `/chart/:date` link; switching language changes no stored data.

**V2 acceptance** – walk through S7 item by item. Manual by the user: CSV in Polish and English Excel, B/W print, both phones.

**V3 security review** – no CSP violations in the production build, logs contain no values or tokens, no third-party requests, no `ports:` in compose.

**V4 operations** – install the backup timer and restic, run one restore drill (A9).

