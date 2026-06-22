# CuraLine — Deployment Plan

This document covers deploying CuraLine to production: the backend API + workers,
the database/cache, TLS, the web frontend, and the mobile app. It also documents
the hardening baked into the backend deployment.

---

## 1. Architecture

```
                       ┌─────────── HTTPS (443) ───────────┐
   Browser / Mobile ──▶│            nginx (TLS)            │
                       │  rate-limit · gzip · sec-headers  │
                       └───────────────┬───────────────────┘
                                       │ http (internal)
                                ┌──────▼──────┐
                                │  web (api)  │  gunicorn + uvicorn workers
                                └──────┬──────┘
                  ┌────────────────────┼────────────────────┐
            ┌─────▼─────┐        ┌─────▼─────┐        ┌──────▼──────┐
            │ postgres  │        │   redis   │        │   worker    │ Celery
            │ (data)    │◀──────▶│ (broker)  │◀──────▶│  + beat     │ jobs
            └───────────┘        └───────────┘        └─────────────┘
                  ▲
            ┌─────┴─────┐
            │  migrate  │  one-shot: alembic upgrade head (runs once, first)
            └───────────┘
```

- **web** — FastAPI under gunicorn (uvicorn workers), behind nginx.
- **worker** — Celery worker; runs the AI chat pipeline, notifications, enrichment.
- **beat** — Celery beat; fires scheduled jobs (appointment reminders, auto-close
  expired slots). **Exactly one** instance.
- **migrate** — one-shot Alembic upgrade; everything else waits for it.
- **postgres** — primary datastore (named volume).
- **redis** — Celery broker/result backend + rate-limit store (AOF persistence).
- **nginx** — TLS termination, HTTP→HTTPS redirect, security headers, rate limits.

The **frontend** (Vite/React) and **mobile** (Expo) are deployed separately
(see §8–9).

---

## 2. Prerequisites

- A Linux host (2 vCPU / 4 GB RAM is a comfortable start) with Docker Engine +
  Docker Compose v2.
- A domain name pointing at the host (for TLS).
- API keys: OpenAI (and optionally Anthropic).
- Outbound SMTP relay for email (SendGrid/SES/Mailgun/…), optional.

---

## 3. Configure secrets (`.env`)

```bash
cd Backend
cp .env.example .env
# Generate strong values:
python -c "import secrets; print(secrets.token_urlsafe(32))"   # SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(24))"   # POSTGRES_PASSWORD
```

Fill in **at minimum**: `SECRET_KEY`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`OPENAI_API_KEY`, `ALLOWED_ORIGINS` (your real frontend origin), and
`FRONTEND_BASE_URL`. Keep `ENABLE_DOCS=False` and `LOG_DIAGNOSE=False`.

`.env` is **never** baked into the image (`.dockerignore`) — it's injected at
runtime via `env_file`. The app refuses to start if `SECRET_KEY` is still the
default, and the prod compose refuses to start without `POSTGRES_PASSWORD`.

---

## 4. TLS certificates

Place `fullchain.pem` and `privkey.pem` in `Backend/nginx/certs/`.

**Let's Encrypt (recommended):**
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d api.yourdomain.com
# then copy/symlink the issued files into Backend/nginx/certs/
```
The prod nginx keeps `/.well-known/acme-challenge/` reachable on port 80 for
renewals. Reload nginx after renewal: `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`.

**Local/staging self-signed:** `Backend/scripts/gen-self-signed-cert.sh`
(or `.ps1` on Windows).

---

## 5. Build, migrate, run (production)

All commands from `Backend/`:

```bash
# 1. Build the immutable image
docker compose -f docker-compose.prod.yml build

# 2. Start everything. Order is enforced automatically:
#    postgres/redis become healthy → migrate runs once → web/worker/beat start.
docker compose -f docker-compose.prod.yml up -d

# 3. Verify
docker compose -f docker-compose.prod.yml ps
curl -fsS https://api.yourdomain.com/health
```

`/health` returns `200` with `{"status":"ok", checks:{database, redis}}` when
healthy, `503` when the database is down.

---

## 6. Operations

**Scale web/workers** (stateless):
```bash
docker compose -f docker-compose.prod.yml up -d --scale web=3 --scale worker=2
```
Keep **beat at 1**. When increasing web replicas, raise `DB_POOL_SIZE`/
`DB_MAX_OVERFLOW` math so `(pool+overflow) × workers × replicas < postgres
max_connections` (default 100).

**Logs:** `docker compose -f docker-compose.prod.yml logs -f web worker beat`
(rotated at 10 MB × 5 files per service).

**Database backup / restore:**
```bash
# Backup (cron this off-host)
docker compose -f docker-compose.prod.yml exec -T postgresdb \
  pg_dump -U "$POSTGRES_USER" appointment_management | gzip > backup_$(date +%F).sql.gz

# Restore
gunzip -c backup_YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgresdb \
  psql -U "$POSTGRES_USER" -d appointment_management
```

**Updates (rolling-ish) & rollback:**
```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d   # migrate runs, then restarts app
# Rollback: redeploy the previous image tag / git ref. Alembic downgrades:
docker compose -f docker-compose.prod.yml run --rm migrate alembic downgrade -1
```
Tag images per release (e.g. `curaline-backend:1.2.0`) so rollback is a tag swap.

---

## 7. Monitoring (recommended next steps)

- Point an uptime monitor at `GET /health`.
- Ship container logs to a collector (Loki/CloudWatch/Datadog).
- Alert on: `/health` 503, worker queue depth, postgres connection saturation,
  container restart loops, disk usage on the postgres volume.

---

## 8. Frontend (web)

Static SPA — build and serve from any static host/CDN (Vercel, Netlify, S3+CF,
or an nginx static container):
```bash
cd Frontend
npm ci && npm run build      # outputs dist/
```
Set the API origin so the SPA's `/v1` calls reach the backend (same-origin proxy
or a configured base URL), and replace the placeholder `curaline.com` domain in
`index.html`, `robots.txt`, `sitemap.xml`, and the OG image before launch.

## 9. Mobile (Expo)

```bash
cd Mobile
# Set DEV/PROD API URLs in src/config.js (PROD must be HTTPS).
npx expo export                      # or EAS build for store binaries
eas build --platform android         # requires an Expo account + EAS config
```
Production builds reject non-HTTPS API URLs by design.

---

## 10. Backend hardening (what's in place)

| Area | Hardening |
|------|-----------|
| **Image** | Multi-stage `python:3.12-slim` build; deps in an isolated venv; no compilers/Rust in the final image; `.dockerignore` keeps `.env`, `venv`, `.git`, tests out of layers. |
| **Runtime user** | Runs as non-root `appuser` (uid 10001); `tini` as PID 1 for clean signal handling/shutdown. |
| **Web server** | gunicorn + uvicorn workers with hard `--timeout` (kills hung-upstream workers), `--graceful-timeout`, and `--max-requests` recycling to bound memory. |
| **Migrations** | Dedicated one-shot `migrate` service; app services wait on `service_completed_successfully` — no concurrent `alembic upgrade` races across replicas. |
| **Startup order** | `depends_on` + healthchecks: app never starts before postgres/redis are healthy. |
| **Scheduled jobs** | Dedicated `beat` service (previously missing — reminders/auto-close now actually run). |
| **Resource caps** | Per-service CPU/memory limits; JSON log rotation (size-capped) so a chatty service can't fill the disk. |
| **Secrets** | Injected via `env_file` at runtime, never baked in; compose refuses to boot without `POSTGRES_PASSWORD`; app refuses default `SECRET_KEY`. |
| **Network** | Only nginx publishes ports (80/443); postgres/redis/web are internal-only on a private bridge network. |
| **TLS / nginx** | TLS 1.2/1.3, HSTS, full security-header set, `server_tokens off`, gzip, upstream keepalive, proxy timeouts, and per-IP rate limits on **all** `/v1` traffic (stricter on `/v1/auth`). |
| **App-level** | Refresh-token rotation w/ reuse detection, in-app rate limiting (Redis, fail-open), PII-safe logging (`diagnose` off), docs disabled by default, CSP shipped with the SPA. |

---

## 11. Production readiness checklist

- [ ] `.env` filled; `SECRET_KEY` and `POSTGRES_PASSWORD` are strong & unique
- [ ] `ENABLE_DOCS=False`, `LOG_DIAGNOSE=False`
- [ ] `ALLOWED_ORIGINS` = real frontend origin(s) only
- [ ] TLS certs in `nginx/certs/`; HTTP→HTTPS verified; HSTS present
- [ ] `docker compose -f docker-compose.prod.yml config` validates
- [ ] `/health` returns 200 through HTTPS
- [ ] One `beat` instance; reminders observed firing
- [ ] Automated off-host postgres backups + a tested restore
- [ ] Uptime + log monitoring wired to `/health`
- [ ] Placeholder `curaline.com` domain replaced everywhere (SEO/OG/sitemap)
- [ ] Real clearinghouse `ELIGIBILITY_PROVIDER`/`_API_KEY` set (or accept sandbox)
