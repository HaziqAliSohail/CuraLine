# CuraLine Roadmap

> Status as of June 11, 2026. Derived from the Zocdoc competitive analysis
> (see [zocdoc-research.md](zocdoc-research.md)) and production-hardening work.

## ✅ Shipped

- **Severity-first AI booking** — intake → severity scoring → smart slot selection → dynamic reschedule swaps
- **Doctor portal** — Morning Briefing (AI digest, cached per doctor/day), severity-coded day schedule with triage intel, one-tap visit outcomes (COMPLETED / NO_SHOW, doctor-only), reschedule visibility
- **Slot self-service (calendar tier 1)** — single + idempotent bulk generation ("every weekday 9–5, 30-min slots"), close/delete with booking guards
- **Doctor onboarding funnel** — apply → admin verification (license number surfaced for board check) → activate; pending doctors invisible to patients, blocked from login and AI booking
- **Doctor password rotation** — admins don't retain credential knowledge
- **Production hardening** — role-separated JWTs, login timing-attack guard, LLM input limits, row-locked booking/swap paths, real /health checks, TLS-ready nginx, env-driven secrets
- **Email infrastructure** — SMTP-driven notifications: application received/approved/rejected, booking confirmations, cancellations, reschedule-request alerts, and day-before reminders (hourly idempotent Celery beat sweep via `reminder_sent` flag). Unconfigured SMTP → log-only; email failures never break a flow
- **Verified-patient reviews** — gated on doctor-recorded COMPLETED outcomes, one per visit, privacy-abbreviated names, live doctor-rating aggregation, public listings + review modals on doctor cards, "Rate your visit" on completed appointments

## 🔜 Next (ordered)

1. **No-show analytics for doctors**
   - Now possible because outcomes are doctor-recorded and trustworthy
   - Per-doctor no-show rate, severity mix over time, busiest days
2. **Doctor invite flow** — admin enters email → doctor receives link → sets own password (email infra now exists; needs a one-time token model)

## 🇺🇸 US go-to-market blockers (build when entering the US)

4. **Insurance filter UX** — "takes my insurance" beats every AI feature in US patient acquisition
   - Insurance plans on Doctor model, filter in patient search, plan selection at registration
5. **Automated license verification** — NPI Registry lookup + state board check (both have APIs) to replace/augment manual admin review at scale

## 🏥 Enterprise tier (build when a hospital asks — not before)

6. **EHR calendar sync (calendar tier 2)** — Epic API integration so CuraLine bookings land in hospital systems natively (Zocdoc's enterprise model)
7. **Multi-tenancy** — multiple hospitals/clinics with isolated schedules

## Positioning (constant)

**"Zocdoc finds you a doctor; CuraLine decides who needs the doctor first."**
Patients: book by *soonest for your severity*, not best-rated. Providers: we sell a
better day (Morning Briefing, no phone tag), not just more patients.

## Deliberate non-goals

- Clinical notes, prescriptions, diagnoses, billing — EMR territory, regulatory weight, different company
- Doctor–patient chat — liability; AI intake already covers pre-visit context
- Per-booking pricing for returning patients — caused Zocdoc's provider revolt; if monetizing per-booking, charge for *new* patient acquisition only
