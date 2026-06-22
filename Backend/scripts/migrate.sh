#!/usr/bin/env bash
set -euo pipefail

# One-shot migration runner. In production this runs as its own service that the
# web/worker/beat services wait on (depends_on: service_completed_successfully),
# so the schema is upgraded exactly once before any app process starts.
echo "[migrate] alembic upgrade head"
alembic upgrade head
echo "[migrate] done"
