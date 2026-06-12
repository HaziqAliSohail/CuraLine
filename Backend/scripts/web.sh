#!/usr/bin/env bash

alembic upgrade head
uvicorn --host 0.0.0.0 --port 8080 --workers 2 main:app
