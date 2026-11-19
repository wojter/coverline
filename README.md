# Coverline

Offline-first PWA for the **symptothermal method** (PSNNPR) with two independent temperature sources, manual cycle interpretation, charts, statistics, and multi-device sync.

## Stack

- **Frontend:** Preact, TypeScript, Vite (`vite-plugin-pwa`), Tailwind CSS, DaisyUI, IndexedDB (`idb-keyval`)
- **Backend:** Python 3.12 (`uv`), FastAPI, SQLite (sync, export, backup/restore)
- **Production:** Docker Compose + Cloudflare Tunnel & Access

## Local development

Prerequisites: Python 3.12, [`uv`](https://docs.astral.sh/uv/), Node.js, `npm`.

1. Install dependencies:

   ```sh
   make setup
   ```

2. Start the API (terminal 1, listens on `127.0.0.1:8000`, uses `./data-dev`):

   ```sh
   make dev-api
   ```

3. Start the frontend dev server (terminal 2, proxies `/api` to `:8000`):

   ```sh
   make dev-web
   ```

4. *(Optional)* Load demo data into the running dev API:

   ```sh
   make dev-seed
   ```

5. Run all checks (lint, API tests, typecheck, web tests, build):

   ```sh
   make check
   ```

## Production (Docker + Cloudflare)

1. Configure environment variables:

   ```sh
   cp .env.example .env
   ```

   Fill in `CF_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ALLOWED_SERVICE_TOKENS`, and `TUNNEL_TOKEN` (see [`docs/cloudflare.md`](docs/cloudflare.md)).

2. Prepare the data directory and start the stack:

   ```sh
   mkdir -p data && sudo chown 10001:10001 data
   docker compose up -d --build
   ```

## Docs

- [`docs/functional-spec.md`](docs/functional-spec.md) – functional specification
- [`docs/architecture.md`](docs/architecture.md) – architecture and sync design
- [`docs/decisions.md`](docs/decisions.md) – architectural decision records
- [`docs/cloudflare.md`](docs/cloudflare.md) – Cloudflare Tunnel & Access setup
