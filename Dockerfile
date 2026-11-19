FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.10.10 AS uv

FROM python:3.12-slim AS api
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim
RUN useradd --system --uid 10001 --no-create-home coverline \
    && mkdir /data && chown coverline /data
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 DATA_DIR=/data STATIC_DIR=/app/static
WORKDIR /app
COPY --from=api /app/.venv /app/.venv
COPY backend/app ./app
COPY --from=web /src/frontend/dist ./static
USER coverline
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
