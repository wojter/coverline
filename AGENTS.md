# Coverline – agent guide

## Source of truth

`docs/functional-spec.md` (what; wins every conflict; never edit) > `docs/architecture.md` (how) > `docs/decisions.md` (why) > `docs/plan.md` (order and split of work). If the plan contradicts the others, stop and report the conflict.

## Rules for every task

1. Read the referenced sections of the docs before writing code.
2. Touch only the files listed in the task, plus their tests. If another file is needed, say so in the report.
3. Done = the task's "Done when" holds and `make check` is green.
4. No domain logic in the backend (D2). No hardcoded UI strings (S4.4). No `style="..."` strings (A8). Logs carry no field values (A8). No third-party requests.
5. Temperatures are integer hundredths everywhere (DB, wire, IndexedDB, domain). Conversion happens only in `tempInput.ts` and the UI.
6. A new architectural choice is appended to `docs/decisions.md` as `Dn` with status **proposed**, and the task stops for review.
7. One commit per task, in Conventional Commits format (see Commits).
8. UI tasks (1.3, U*): follow the style of the reference apps, never their features (D19).

## Commands

- `make setup`: install backend (`uv sync`) and frontend (`npm ci`) dependencies.
- `make check`: lint (ruff), API tests (pytest), typecheck, web tests (vitest), web build. Must be green before a task is done.
- `make dev-api`: API on `127.0.0.1:8000` with `ENV=dev AUTH_MODE=dev`, using `./data-dev`. Never the production DB.
- `make dev-seed`: fills the running dev API with a demo dataset (through the normal sync path, localhost only).
- `make dev-web`: Vite dev server; `/api` is proxied to the API.

Dependencies: backend in `backend/pyproject.toml` (pinned with `==`, managed with uv); frontend in `frontend/package.json` (exact versions, `npm`). Resolve only versions published at least 7 days ago.

## Code layout

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

## Commits

Format: [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <summary>`, for example `feat(api): add op models per wire contract`. One commit per task.

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `chore`.
- Scope is the area of the code (`api`, `domain`, `i18n`, `data`, `web`, `ui`, `chart`, `dev`, ...); optional.
- Summary is imperative, lower case, no trailing period.
- The task id goes in the body as `Task: <task id>`.
