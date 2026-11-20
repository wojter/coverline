# Coverline – Decisions

Short records of why the architecture looks the way it does. Newest decisions go last.
Status: **accepted** unless marked otherwise.

## D1. Local-first client, thin server

- **Decision:** the client keeps the whole dataset in IndexedDB. The server is a validated store with sync, history and backup.
- **Why:**
  - The app must work offline, including derived values.
  - The dataset is tiny (about 365 days per year).
  - Logic on the server would have to be duplicated in the client.
- **Rejected alternatives:**
  - Server-centric REST: duplicated logic, and a whole-day PUT breaks the partial-merge rule.
  - No backend: iOS can evict storage, and a lost phone means lost data.
  - PocketBase or CouchDB: its auth and data model do not fit, for a large dependency.

## D2. Domain logic only in TypeScript

- **Decision:** cycles, derived values, marks, stats and CSV live in `frontend/src/domain/`. The server computes nothing.
- **Why:** one implementation that works offline and is unit-tested in one place. CSV depends on the selected language and on derived values, so it is built in the client.

## D3. Python backend despite a TS domain

- **Decision:** FastAPI with stdlib `sqlite3` and no ORM.
- **Why:** the stack was chosen up front. The server is small (validation, storage, sync, backup), so the second language costs little.

## D4. Network: Cloudflare Tunnel and Access with service tokens per device

- **Decision:**
  - The `/api` path uses Service Auth with one token per device.
  - The app shell is served with Bypass.
  - The token is pasted once in the app.
- **Why:**
  - No public IP, and no VPN app wanted on the phones.
  - The interactive Access login is fragile inside an installed iOS PWA.
  - Headers cannot be added to page navigations, so the shell must be public. It contains no data.
- **Accepted trade-offs:**
  - Cloudflare terminates TLS and can see the traffic.
  - The token is stored on the device. This is mitigated by the strict CSP and per-device revocation.
- **Rejected alternatives:**
  - Interactive Access login (problems with logging in again inside the PWA).
  - Tailscale (needs a VPN app). It remains the fallback, as auth is isolated in `auth.py`.
  - LAN only (no remote sync, certificate problems).

## D5. Identity is a device label

- **Decision:** the identity is the label mapped to the token's Client ID (`ios`, `android`, `pc`). F6 shows it where the spec says "logged-in email".
- **Why:** service tokens carry no email.

## D6. Full-dataset pull with an ETag instead of delta sync

- **Decision:** `GET /api/data` returns everything. An unchanged dataset gets `304`.
- **Why:**
  - It needs no revision counters or tombstones.
  - Deletions and restores from backup sync correctly with no extra logic.
  - The payload stays in the hundreds of kilobytes even after years.
- **Revisit if:** the dataset grows past a few megabytes.

## D7. Field-level ops, last write wins

- **Decision:**
  - Clients send ops per row (`set` some fields or `delete`), and the server applies them in order.
  - Unsent local ops are re-applied on top of server data.
  - Invalid ops are rejected one by one and kept in `failed` for the user.
- **Why:**
  - It matches the spec's partial-merge rule.
  - Single user, so conflicts are rare.
  - One bad op cannot block the queue.

## D8. A cleared temperature deletes the reading

- **Decision:** a `temps` row exists only if a reading was taken. Clearing it deletes the row and its mark. The deletion is snapshotted into history.
- **Why:** it fixes a reading entered on a day when nothing was measured, and keeps "no reading" (which breaks the curve) distinct from "excluded".

## D9. No trusted localhost

- **Decision:** production accepts only verified Access JWTs. Development uses `AUTH_MODE=dev` with a separate DB.
- **Why:** inside Docker, a request from localhost and one from `cloudflared` cannot be reliably told apart.

## D10. Earlier requirements draft is superseded

- **Decision:** the first draft (N sources, Bland-Altman, t/ø/f/S/S+ mucus codes, per-reading time, interactive login, ...) is not used. Only `functional-spec.md` counts.

## D11. Cycles are rows with a stable id

- **Decision:** a `cycles` table keyed by a client-generated id, with `start_date` (unique), an optional `end_date` and `excluded_from_stats`. Days and readings stay keyed by date.
- **Why:**
  - Moving a wrongly marked start is common. It must be one op and keep the coverlines, fertile days and notes of the cycle.
  - An op queued offline must reach the right cycle even after its start was moved on another device.
  - A break in observations and a disturbed cycle must not distort the statistics.
- **Rejected alternatives:**
  - `days.cycle_start` plus `cycle_notes` keyed by start date: moving a start re-keys the notes or orphans them, and an offline op on the old key creates an orphan row.
  - A `cycle_id` on every day: moving a boundary rewrites many rows, and days outside any cycle need special values.
- **Supersedes:** "there is no cycles table" from the first architecture draft.

## D12. Constraints in the database

- **Decision:** `STRICT` tables, typed columns, `CHECK` constraints for dates, booleans and codes, and a foreign key from `temps` to `sources`. All checks are single-row.
- **Why:**
  - A second line of defence behind Pydantic, for ops from outdated clients and old outbox entries.
  - SQLite gives a column declared `JSON` NUMERIC affinity, so `'12'` comes back as an integer. `STRICT` with `TEXT` avoids it.
- The server still computes no domain values. Cross-row rules stay in the client.

## D13. One coverline column per source

- **Decision:** `coverline_1` and `coverline_2` instead of one JSON object.
- **Why:**
  - Last write wins per field: with one JSON field, setting source 1 on one device and source 2 on another loses one of them.
  - The range check is a plain column check, the same as for readings.
  - There are always exactly 2 sources (spec decision 4).


## D14. PWA update prompt through the virtual module

- **Decision:** `vite-plugin-pwa` with `registerType: 'prompt'`, `injectRegister: null`, and `useRegisterSW` from `virtual:pwa-register/preact` in an update toast.
- **Why:**
  - Prompt mode needs the virtual module to know when an update is waiting. With `injectRegister: 'script'` alone, the "update available" toast (architecture 6.7) cannot be built.
  - The registration code is bundled into the app's own JS, so the CSP needs no inline script.
- **Supersedes:** `injectRegister: 'script'` from the first architecture draft.

## D15. Default source names are translations

- **Decision:** sources are seeded with `name = ''`. While the name is empty, the UI shows the translated default ("Pomiar 1" / "Measurement 1"). A name typed by the user is shown as typed and never translated.
- The name is set in F6 (Sources) at any time, e.g. "Usta – termometr Microlife", so the two readings are not confused. Clearing it brings back the translated default.
- **Why:** the spec gives a default name per language (F6), but stored user text is never translated (4.4). A seeded Polish name would show in the English UI.

## D16. Language and theme are per device

- **Decision:** the language and the light/dark theme are stored in IndexedDB `meta` and are not synced. The language defaults to the browser language (`pl`, otherwise `en`).
- **Why:** each device follows its own browser by default (spec 4.4), and the choice works before the device is connected.

## D17. Interpretation of computed values

Where the spec leaves room, it is read as follows:
- **Mucus peak to third high day** (F5): `third_high_day − mucus_peak` as a date difference. It can be 0 or negative.
- **Cycle number:** the first cycle gets `cycle_number_start` (default 1), and each later cycle adds 1. Past cycles are backfilled through their start dates in F4. Leave the default at 1 if all of them are entered.
- **Source evaluation** (F5): counts only completed, non-excluded cycles, the same base as "cycles with a rise marked". The current cycle is counted once it ends.
- **Shortest / longest:** the last N cycles (default 12), as in the spec, not the last 12 months.
- **`chart_note` length:** counted in Unicode code points on every layer (`[...s].length` in TS, `len()` in Python, `length()` in SQLite).

## D18. Seed defaults and tooling

- **Decision:**
  - Source 1: `oral`, `circle`, `#2563eb`. Source 2: `oral`, `square`, `#d97706`. Both 35.50–38.00 °C. Colours are stored as `#rrggbb`.
  - `default_intention` is unset (JSON `null`), so new cycles get no intention until a default is chosen in F6. `cycle_number_start` = 1, `stats_n` = 12.
  - Tooling: npm with a lockfile, `pyproject.toml` with pinned dependencies, ruff.
- **Why:** the spec leaves these open, and all of them can be changed in F6. Blue and amber stay apart for colour-blind users and do not clash with the red bleeding colours of the calendar.

## D19. UI style from reference apps, features from the spec

- **Decision:** the look follows the reference apps: soft off-white page, white rounded cards, cycle ring, pill chips and tiles, floating bottom bar.
- **Not in the PoC:** predictions (next period, ovulation, estimated fertile window, confidence) and generated interpretation text. Mood and emoji are not taken over.
- **Why:** the spec has no rules engine and interpretation is manual (spec 0). Showing estimates would contradict it.
- **Deferred, not rejected:** the owner keeps the predictions from the screenshots for a later phase. Nothing is built for them now. Generated interpretation text is spec backlog item 5. Predictions are not in the spec backlog yet.

## D20. Runtime configuration and API details

- **Status:** proposed
- **Decision:**
  - Environment: `ENV` (`dev` or `prod`), `AUTH_MODE` (`cloudflare` or `dev`), `DEV_IDENTITY`, `CF_TEAM_DOMAIN` (`https://<team>.cloudflareaccess.com`, also the expected `iss`), `CF_ACCESS_AUD`, `ALLOWED_SERVICE_TOKENS`, `DATA_DIR` (database `coverline.db`, backups in `backup/`), `STATIC_DIR` (the built PWA).
  - `POST /api/sync` takes `{"ops": [...]}`. `GET /api/health` returns the plain text `ok`.
  - A `history.snapshot` is the old row in the wire format of architecture 5.1.
  - The client syncs only when a token is set. In `AUTH_MODE=dev` the server ignores the token headers, so any `<id>:<secret>` connects a dev client.
- **Why:** the architecture names these but leaves their exact form open. Wire-format snapshots can be restored with ordinary ops later (backlog 2).

## D21. Spike gate deferred

- **Status:** proposed
- **Decision:** the app is built before spikes S1–S3 (plan 1.4) are run on the phones. The chart sizing constants are provisional until S3 is printed.
- **Why:** the owner asked to see the whole app first. S1 and S2 need the deployed tunnel and both phones; their results may still change D4 or D1.

## D22. Bleeding is one code plus staining and spotting

- **Status:** proposed
- **Decision:**
  - `bleeding` takes `bleeding`, `staining` or `spotting`, as on the paper card (Krwawienie / brudzenie / plamienie). `light`, `medium` and `heavy` are removed.
  - The chart shows a letter in the bleeding row instead of a coloured square: PL `K` / `B` / `P`, EN `B` / `St` / `Sp` (`codes.bleedingSymbol`). The letters survive a black-and-white print.
  - Last day of menstruation (spec 2.3) is the run of `bleeding` days from day 1. Staining and spotting end it.
  - The schema stays v1 with the new `CHECK`. The existing databases (production and dev) were rebuilt once by hand: `light`, `medium` and `heavy` became `bleeding` and `data_version` changed. The app carries no migration for the old values, so a database from before this change (or an old backup) must be converted the same way before use.
- **Why:** the owner records only these three on the card. The levels were never used by any rule except "light or heavier", which now reads `bleeding`.
- **Spec:** 2.3 and 2.4 were edited by the owner's request, as this contradicts the earlier value table.

## D23. Connect screen gates the app until a token is stored

- **Status:** proposed
- **Decision:**
  - While the device has no token, the app renders only a connect screen (no navigation, no views). `ready` (set once IndexedDB is read) keeps the UI blank until then, so a connected device never flashes the screen.
  - The gate depends on the stored token only, not on the server. A device with a token opens the app offline. A token the server later refuses keeps the app open with the token banner (the outbox stays safe) and Settings / Disconnect leads back to the connect screen.
  - `connect()` stores the token only after `/api/me` accepts it, or when the server cannot be reached (offline). A refused token is never stored, so the screen stays mounted with the error.
  - Disconnect keeps the local data and outbox in IndexedDB. Connecting again syncs them.
- **Why:** an unconnected install showed the full empty app, which looked usable while nothing could sync. Replaces "Without a token, the app works locally" in architecture 3.
