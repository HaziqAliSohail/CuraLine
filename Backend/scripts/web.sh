#!/usr/bin/env bash
set -euo pipefail

# Migrations: handy to auto-apply in dev / single-node. In a multi-replica
# production deploy run the dedicated one-shot `migrate` service instead and set
# RUN_MIGRATIONS=false here, so replicas don't race on `alembic upgrade head`.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[web] applying database migrations..."
  alembic upgrade head
fi

# Dev convenience: auto-reload with a single uvicorn process.
if [ "${WEB_RELOAD:-false}" = "true" ]; then
  echo "[web] starting uvicorn with --reload (dev)..."
  exec uvicorn --host 0.0.0.0 --port 8080 --reload main:app
fi

WORKERS="${WEB_CONCURRENCY:-3}"
TIMEOUT="${WEB_TIMEOUT:-60}"

# Production: gunicorn manages uvicorn workers with hard request timeouts (kills
# a worker stuck on a hung upstream call) and periodic recycling (--max-requests)
# to bound any slow memory growth.
echo "[web] starting gunicorn: ${WORKERS} uvicorn workers, ${TIMEOUT}s timeout"
exec gunicorn main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8080 \
  --workers "${WORKERS}" \
  --timeout "${TIMEOUT}" \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --access-logfile - \
  --error-logfile -
