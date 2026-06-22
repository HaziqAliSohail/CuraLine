# End-to-end tests (Playwright)

Browser tests that drive the real app against a live stack. They cover the
booking-critical path that unit tests can't: the consent gate and the patient
booking surfaces.

## What's covered
- `smoke.spec.js` — guest landing + login page render.
- `auth.spec.js` — **register → medical-disclaimer consent gate → accept → triage chat unlocks** (no LLM, no seed needed).
- `booking.spec.js` — login as the demo patient → doctor directory lists specialists → appointments page loads (needs seeded data).

## Run it locally
The frontend dev server proxies `/v1` to the backend, so run both:

```bash
# 1. Backend on :8080 (with Postgres/Redis up, or USE_SQLITE=True for a quick run)
cd Backend
alembic upgrade head && python seed.py        # seed demo doctors/slots/patient
uvicorn main:app --port 8080

# 2. Frontend dev server on :3001 (proxies /v1 -> :8080)
cd Frontend
npm run dev

# 3. E2E (in a third shell)
cd Frontend
npx playwright install chromium    # one-time
npm run e2e
```

Point at a different stack with `E2E_BASE_URL=https://staging.example.com npm run e2e`.

Demo credentials seeded by `seed.py`: patient `john@example.com` / `Patient@1234`.

## CI
`.github/workflows/e2e.yml` runs the whole thing on pushes to `main` (and on
demand): it spins up Postgres + Redis, migrates + seeds, starts the backend and
the vite dev server, installs the Chromium browser, runs the specs, and uploads
the Playwright HTML report as a build artifact.

## Notes
- These need real servers — they won't run from a bare checkout without the stack
  up (that's why they're a separate job from the unit tests).
- The chat *triage* booking depends on the LLM (non-deterministic), so the e2e
  exercises the deterministic browse-and-book surfaces plus the consent gate; the
  AI severity logic is covered deterministically by the backend eval harness
  (`Backend/eval`, gated in CI via `tests/test_triage_eval.py`).
