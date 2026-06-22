# syntax=docker/dockerfile:1
# ── Builder: compile/install deps into an isolated venv ─────────────────────
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# build-essential + libffi for any sdist-only wheels (e.g. bcrypt). On slim
# (glibc) cryptography/psycopg2 install as manylinux wheels — no Rust toolchain
# needed, unlike the Alpine build.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libffi-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt


# ── Runtime: slim image with only the venv + app, run as non-root ───────────
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH=/BackgroundJobs

# tini = correct PID-1 signal handling for graceful shutdown; curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends tini curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid 10001 --create-home appuser

COPY --from=builder /opt/venv /opt/venv

WORKDIR /BackgroundJobs
COPY . .

# Normalize line endings, make scripts executable, hand ownership to the
# non-root runtime user.
RUN sed -i 's/\r$//' scripts/*.sh \
    && chmod +x scripts/*.sh \
    && chown -R appuser:appuser /BackgroundJobs

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./scripts/web.sh"]
