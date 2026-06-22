# CuraLine Roadmap

> Status as of June 11, 2026. Derived from the Zocdoc competitive analysis
> (see [zocdoc-research.md](zocdoc-research.md)) and production-hardening work.

## ✅ Shipped

- **Severity-first AI booking** - intake → severity scoring → smart slot selection → dynamic reschedule swaps
- **Doctor portal** - Morning Briefing (AI digest, cached per doctor/day), severity-coded day schedule with triage intel, one-tap visit outcomes (COMPLETED / NO_SHOW, doctor-only), reschedule visibility
- **Slot self-service (calendar tier 1)** - single + idempotent bulk generation ("every weekday 9–5, 30-min slots"), close/delete with booking guards
- **Doctor onboarding funnel** - apply → admin verification (license number surfaced for board check) → activate; pending doctors invisible to patients, blocked from login and AI booking
- **Doctor password rotation** - admins don't retain credential knowledge
- **Production hardening** - role-separated JWTs, login timing-attack guard, LLM input limits, row-locked booking/swap paths, real /health checks, TLS-ready nginx, env-driven secrets
- **Email infrastructure** - SMTP-driven notifications: application received/approved/rejected, booking confirmations, cancellations, reschedule-request alerts, and day-before reminders (hourly idempotent Celery beat sweep via `reminder_sent` flag). Unconfigured SMTP → log-only; email failures never break a flow
- **Verified-patient reviews** - gated on doctor-recorded COMPLETED outcomes, one per visit, privacy-abbreviated names, live doctor-rating aggregation, public listings + review modals on doctor cards, "Rate your visit" on completed appointments
- **Practice insights (no-show analytics)** - `/doctor/analytics` + Insights page: no-show rate (from doctor-recorded outcomes), case mix by severity, busiest weekday, selectable 30/90/365-day windows
- **Doctor invite flow** - admin invites by email → doctor receives one-time link (7-day expiry) → sets own password → lands signed in. Admin never knows doctor credentials; link surfaced in admin UI for manual sharing when SMTP is off
- **Insurance UX (complete)** - plan pickers at registration/profile, badges on doctor cards, "matches my plan" auto-default filter, single canonical plan list (`Frontend/src/constants/insurance.js`)
- **Automated NPI verification** - `POST /doctors/{id}/verify-npi` checks the live CMS NPI Registry (free, no key) with loose name matching; admin UI one-click verify with VERIFIED / MISMATCH / NOT_FOUND / registry-down badges. Applicants can supply NPI at apply time
- **Multi-tenancy foundation** - `Hospital` entity, doctor↔hospital assignment, hospital shown on doctor cards, `?hospital_id=` search filter, seeded default hospital
- **EHR integration seam** - `Backend/integrations/ehr.py` adapter protocol (inactive Null adapter) + full Epic FHIR activation plan in [ehr-integration.md](ehr-integration.md)
- **Mobile app (Expo / React Native)** - full patient + doctor portals in `Mobile/`: AI booking chat, visits + verified reviews, insurance-filtered doctor search, reschedule swaps, Morning Briefing with one-tap outcomes, slot management, insights. Tokens in OS keychain (SecureStore). Runs via Expo Go; see Mobile/README.md
- **Preferred-doctor booking fix** - "book me with Dr. X" now wins over specialization routing, with graceful fallbacks; severity-1 visits no longer show urgency banners
- 
- **Refresh-token auth** - 30-min access tokens silently renewed via single-use rotating refresh tokens (30 days); reuse detection revokes the whole session family; logout + password-change revocation; silent-renewal interceptors in web and mobile clients
- **Push notifications (Expo Push)** - device registration endpoints, dispatcher beside the emailer (TESTING outbox, never breaks flows), wired into booking confirmations, day-before reminders, and severity-swap requests; mobile registers on sign-in, unregisters on logout
- **TLS staging tooling** - one-command self-signed cert generators (`gen-self-signed-cert.sh`/`.ps1`); production still needs a real certbot cert (mobile releases require it)
- **Scalability/reliability hardening (round 1)** - DB indexes on hot FK/filter columns (migration `b7e2f9a14c63`); N+1 eliminated via eager-loading in appointment/doctor-portal/reschedule lists; engine `pool_pre_ping` + `pool_recycle` + env-tunable pool sizing; app-level Redis rate limiting (fail-open, host-independent) on login/register/refresh; `/docs` disabled by default in prod; pinned `anthropic`
- **Async AI chat (round 2)** - the chat turn now dispatches a Celery job (`POST /inference/` → `{job_id, status}`) and clients poll `GET /inference/result/{job_id}`, so the web process no longer blocks or pins a DB connection across the multi-second LLM call. Inline fallback when no broker is reachable (local dev needs no worker). Web + mobile chat updated to dispatch-then-poll with gentle backoff
- **Pre-deploy security hardening** - full per-endpoint authorization audit (every patient/doctor resource is owner-scoped); chat-result poll now owner-verified (defence-in-depth on unguessable UUIDs); doctor contact PII (email/phone) removed from the public listing via `DoctorPublicOutSchema` (kept on self-profile + admin views); append-only `audit_logs` table recording destructive/sensitive actions (cancel, doctor outcome, slot/doctor delete, application approve/reject, password change, reschedule accept/decline) with actor + IP; list endpoints bounded (doctors paginated, max 200/page)
- **PII log scrubbing** - loguru `diagnose` disabled by default (no variable-value dumps in tracebacks); raw chat messages, patient names/emails no longer logged (logged by id instead); recipient emails masked in mail logs; exception handlers log path only (no query strings, so geo/filters don't leak)
- **Mobile hardening** - HTTPS enforced for release builds (`__DEV__`-split API URL + startup guard that throws on non-HTTPS prod); Android `usesCleartextTraffic: false` (iOS ATS already blocks cleartext); patched the form-data high CVE via clean reinstall (the 18 remaining moderates are build-time deps needing an Expo 56 bump - deferred); confirmed tokens stay in keychain (SecureStore), no console/secret leaks. README documents the pre-build security checklist
- **Frontend hardening (web)** - patched dependency CVEs (react-router open-redirect, form-data) via `npm audit fix`; production build ships no source maps and strips console/debugger; host-independent CSP injected as `<meta>` into the built HTML (build-only, doesn't break dev HMR); `ErrorBoundary` prevents white-screen crashes; verified no `dangerouslySetInnerHTML`/`target=_blank` tabnabbing/leaked env vars. Remaining: esbuild *dev-server* advisory (dev-only, needs a Vite major bump - deferred); JWT-in-localStorage XSS tradeoff (mitigated by React auto-escaping + CSP; httpOnly-cookie migration is a future cross-client refactor)
- 
- **US insurance eligibility** — real-time coverage check (X12 270/271) via a provider-agnostic clearinghouse adapter (Stedi/pVerify/Availity/Optum), with a sandbox mode so the flow is demoable with no paid account and a fail-safe UNKNOWN on outage. Patient insurance now captures carrier + member ID + group number; `POST /insurance/verify` returns active/copay; web Profile has "Check my coverage" with copay estimate. US carrier list endpoint. Live integration flips on by setting `ELIGIBILITY_PROVIDER`+`ELIGIBILITY_API_KEY`

## 🔜 Next (scalability/reliability - round 3)

1. **Migrations as a one-shot deploy step** - `web.sh` runs `alembic upgrade head` per replica; with 2+ web replicas they race. Split into a dedicated migrate job
2. **Observability** - request IDs, Sentry error tracking, Prometheus metrics
3. **Prod Dockerfile/compose** - drop the dev bind-mount; gunicorn process manager with CPU-tuned workers + request timeout
4. **State medical board license check** - no single national API; per-state scrapers/services (e.g. Verifiable) when US volume justifies it

## 🏥 Enterprise tier (build when a hospital asks - not before)

2. **EHR calendar sync activation** - implement `EpicFHIRAdapter` against the existing seam once a hospital provides Epic sandbox credentials (see [ehr-integration.md](ehr-integration.md) checklist)
3. **Full tenant isolation** - per-hospital admins, scoped schedules and severity-swap pools (schema foundation already in place)

## Positioning (constant)

**"Zocdoc finds you a doctor; CuraLine decides who needs the doctor first."**
Patients: book by *soonest for your severity*, not best-rated. Providers: we sell a
better day (Morning Briefing, no phone tag), not just more patients.

## Deliberate non-goals

- Clinical notes, prescriptions, diagnoses, billing - EMR territory, regulatory weight, different company
- Doctor–patient chat - liability; AI intake already covers pre-visit context
- Per-booking pricing for returning patients - caused Zocdoc's provider revolt; if monetizing per-booking, charge for *new* patient acquisition only
