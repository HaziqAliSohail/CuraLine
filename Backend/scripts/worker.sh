#!/usr/bin/env bash
set -euo pipefail

# --max-tasks-per-child recycles workers periodically to bound memory growth.
exec celery -A tasks.celery.celery worker \
  -Q worker-queue \
  --concurrency "${WORKER_CONCURRENCY:-4}" \
  --max-tasks-per-child "${WORKER_MAX_TASKS:-200}" \
  --loglevel "${CELERY_LOGLEVEL:-info}"
