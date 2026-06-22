#!/usr/bin/env bash
set -euo pipefail

# Celery beat scheduler — drives the periodic jobs defined in tasks/celery.py
# (auto-close expired slots, send appointment reminders). Run EXACTLY ONE beat
# instance across the whole deployment, or scheduled jobs will fire in duplicate.
exec celery -A tasks.celery.celery beat \
  --loglevel "${CELERY_LOGLEVEL:-info}"
