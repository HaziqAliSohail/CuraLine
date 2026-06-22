# EHR Integration Plan (Enterprise Tier)

> Status: **designed, not active**. The adapter seam exists at
> `Backend/integrations/ehr.py`; no live wiring until a hospital customer
> provides EHR sandbox access. Do not build further without one - this is the
> Zocdoc lesson: their Epic integration came *after* health systems signed.

## ## Why this can't be "just built"

Epic (and every major EHR) requires:
- A signed hospital customer who sponsors API access (Epic "App Market"/Connection Hub)
- Hospital-issued FHIR endpoint URLs + OAuth2 client credentials (SMART Backend Services)
- Per-site testing in the hospital's non-production Epic environment

None of these exist without a customer. What we *can* prepare - and have - is the
seam so integration is additive, not a refactor.

## Architecture (when activated)

```
CuraLine slot/appointment events
        │
        ▼
EHRSyncAdapter (Protocol - integrations/ehr.py)
        │
        ├── NullEHRAdapter        (default, active today: no-ops)
        └── EpicFHIRAdapter       (built per customer)
                │  OAuth2 SMART Backend Services (JWT client assertion)
                ▼
        Epic FHIR R4 API
          - Slot        (publish open/closed slots)
          - Appointment (book / cancel, $book operation)
          - Schedule    (map CuraLine doctor → Epic Schedule resource)
```

## Sync model

| Direction | What | How |
|---|---|---|
| CuraLine → EHR | booking, cancellation | `push_appointment_booked/cancelled` after commit, via Celery task with retry (same pattern as email) |
| CuraLine → EHR | slot open/close | `push_slot_opened/closed` from slot self-service + auto-expiry worker |
| EHR → CuraLine | doctor availability | `pull_availability(doctor_id)` on a beat schedule; reconcile into `doctor_slots` (EHR is source of truth for enterprise doctors) |

**Conflict rule for enterprise doctors:** the EHR wins. CuraLine becomes the
intelligent triage layer on top of the hospital's calendar - never a second
source of truth. This is the core positioning: we sell the *severity brain*,
Epic keeps the calendar.

## Mapping notes

- `Doctor.hospital_id` (already in schema) selects which adapter/credentials apply - per-hospital config lives on the Hospital row when activated
- CuraLine `DoctorSlot` ↔ FHIR `Slot` (status: free/busy); `Appointment` ↔ FHIR `Appointment` (status: booked/cancelled)
- Severity score travels in `Appointment.comment` or a CuraLine extension - Epic has no triage-priority field, which is exactly the gap we monetize

## Activation checklist (first hospital)

1. Hospital signs; obtain Epic sandbox: client ID, JWKS registration, FHIR base URL
2. Implement `EpicFHIRAdapter` against `EHRSyncAdapter`; integration tests against sandbox
3. Add `ehr_provider` + credential config columns to `hospitals` (migration)
4. Wire adapter calls (Celery-dispatched) into: appointment create/cancel, slot create/close/expire
5. Beat task: `pull_availability` reconciliation per enterprise doctor
6. Feature-flag per hospital; pilot with one department before full rollout
