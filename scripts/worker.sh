#!/usr/bin/env bash

celery -A tasks.celery.celery worker -Q worker-queue --loglevel=info

