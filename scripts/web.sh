#!/usr/bin/env bash

alembic upgrade heads
uvicorn --reload --host 0.0.0.0 --port 8080 main:app
