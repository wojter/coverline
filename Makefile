.PHONY: setup check lint test-api typecheck test-web build-web dev-api dev-seed dev-web

setup:
	cd backend && uv sync --locked
	cd frontend && npm ci

check: lint test-api typecheck test-web build-web

lint:
	cd backend && uv run --frozen ruff check . && uv run --frozen ruff format --check .

test-api:
	cd backend && uv run --frozen pytest

typecheck:
	cd frontend && npm run typecheck

test-web:
	cd frontend && npm run test

build-web:
	cd frontend && npm run build

dev-api:
	mkdir -p data-dev
	cd backend && ENV=dev AUTH_MODE=dev DEV_IDENTITY=dev DATA_DIR=$(CURDIR)/data-dev uv run uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000

dev-seed:
	cd backend && uv run python scripts/dev_seed.py

dev-web:
	cd frontend && npm run dev
