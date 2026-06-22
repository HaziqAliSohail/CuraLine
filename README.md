# CuraLine - Smart Hospital Appointment System

CuraLine is an AI-powered hospital registration portal for patients with severe illness who need urgent care. Instead of a generic first-come-first-served queue, CuraLine analyzes each patient's symptoms and medical history to assign a **severity score**, then intelligently schedules appointments so the most critical patients are always seen first.

---

## How It Works

```
Patient describes symptoms
        ↓
AI intake conversation (collects symptoms, duration, pain level)
        ↓
AI severity analysis (scores 1–5, recommends specialization)
        ↓
Smart slot selection (picks best open slot vs. existing bookings)
        ↓
Appointment booked + patient notified
        ↓
If severity ≥ 4 → asks 3 lower-priority patients in earlier slots to switch
```

---

## Features

- **Conversational AI booking** - Patients describe their condition in natural language; the system conducts intake, tags severity, and books automatically
- **Dual-Provider LLM with Fallback** - OpenAI (primary) with automatic Anthropic Claude fallback; if primary fails (timeout, rate-limit, API error), the system transparently retries on the secondary provider
- **Token Cost Optimization** - Compressed prompts (~30% fewer tokens), global max_tokens cap (512), Anthropic prompt caching (`cache_control`), and OpenAI automatic caching for prompts ≥1024 tokens
- **Urgent Care RAG Guidance** - A static knowledge base of ~40 condition-to-guidance mappings recommends actionable next steps (Call 911, Visit Urgent Care, Telehealth, First Aid) with legally-safe disclaimers - never diagnoses or prescribes
- **Severity-first scheduling** - Appointments are ranked 1–5 (routine → critical); critical patients surface to earlier slots
- **Two-Way Dynamic Rescheduling** - When a critical patient books, the system requests lower-priority patients in the earliest slots to switch, performing atomic swaps upon confirmation
- **Doctor slot management** - Doctors define their daily schedule with precise time slots and a configurable booking close window (e.g. "close this slot 15 min before start")
- **Role-Based Access Control (RBAC)** - Secure doctor and slot write/delete operations restricted exclusively to admin-level accounts
- **Automatic slot expiry** - A background Celery worker automatically closes slots that have passed their booking window
- **Rate-Limiting & Proxy Hardening** - Authentication routes rate-limited to 10 requests per minute with secure, non-root Docker builds and Nginx proxy configs
- **Verified Patient Reviews** - Reviews can only be left for visits the doctor marked COMPLETED, so every review comes from a patient who actually attended (Zocdoc-grade integrity). One review per visit, privacy-abbreviated names ("John C."), live doctor-rating aggregation, public per-doctor review listings
- **Email Notifications** - Booking confirmations, cancellations, day-before appointment reminders (hourly idempotent Celery sweep), reschedule-request alerts, and doctor application received/approved/rejected emails. SMTP-driven; with no `SMTP_HOST` configured, emails are logged instead so dev needs zero setup. Email failures never break a booking
- **Doctor Portal** - Doctors get their own role-separated portal: an AI **Morning Briefing** summarizing the day's case mix, a severity-coded day schedule with each patient's triage intelligence (chief complaint, severity rationale, medical history), one-tap visit outcomes (Completed / No-show), self-service slot management with bulk generation ("every weekday 9–5, 30-min slots"), and visibility into severity swaps touching their calendar. Doctor accounts are provisioned by admins - no self-registration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Lucide Icons |
| API | FastAPI (Python 3.12, Pydantic V2) |
| Database | PostgreSQL (Production) / SQLite (Local Dev) |
| Migrations | Alembic |
| Task queue | Celery + Redis |
| AI / LLM | OpenAI gpt-4o-mini (primary) + Anthropic Claude Haiku (fallback) |
| Auth | passlib (bcrypt) + python-jose (JWT) |
| Web server | Uvicorn behind Nginx |
| Containers | Docker + Docker Compose (Non-root execution) |


---

## Project Structure

```
CuraLine/
├── main.py                        # FastAPI app, CORS, exception handlers
├── settings.py                    # Pydantic settings (env-driven config)
├── requirements.txt
│
├── models/
│   ├── mixins.py                  # PersonalDataMixin, TimestampMixin
│   ├── patient.py                 # Patient (with password_hash)
│   ├── doctor.py                  # Doctor (availability, specialization, slots)
│   ├── appointment.py             # Appointment (severity_score, slot_id FK)
│   ├── doctor_slot.py             # DoctorSlot (date, time, close window)
│   └── reschedule_request.py      # RescheduleRequest (PENDING/ACCEPTED/DECLINED)
│
├── database/
│   └── db.py                      # Engine, sessionmaker, get_db_session dependency
│
├── clients/
│   ├── __init__.py                # Instantiates dual-provider llm_client from settings
│   ├── llmclient.py               # Dual-provider LLM client with automatic fallback
│   ├── mapper.py                  # LLM provider map (OpenAI + Anthropic)
│   ├── prompts.py                 # Compressed system prompts: intake + severity analysis
│   └── urgent_guidance.py         # Static RAG knowledge base (~40 conditions) + keyword matcher
│
├── tasks/
│   ├── celery.py                  # Celery app + beat schedule
│   ├── chat_tasks.py              # AI booking pipeline task + reschedule notifier
│   └── slot_tasks.py              # Periodic task: auto-close expired slots
│
├── migrations/                    # Alembic migration scripts
│
├── web/
│   ├── __init__.py                # Assembles all routers under web_router
│   ├── auth/                      # POST /register, POST /login
│   ├── inference/                 # POST /inference (AI booking chat)
│   ├── doctors/                   # CRUD /doctors
│   ├── slots/                     # CRUD /slots + /close
│   ├── patients/                  # GET /patients/me
│   ├── appointments/              # GET/PUT/DELETE /appointments
│   └── reschedule/                # POST /reschedule/{id}/accept|decline
│
├── scripts/
│   ├── web.sh                     # Run migrations then start Uvicorn
│   └── worker.sh                  # Start Celery worker
│
└── nginx/
    └── nginx.conf                 # Reverse proxy → /v1 to FastAPI
```

---

## API Reference

All endpoints are prefixed with `/v1`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ✗ | Register a new patient |
| POST | `/auth/login` | ✗ | Patient login → returns JWT token (role: patient) |
| POST | `/auth/doctor/login` | ✗ | Doctor portal login → returns JWT token (role: doctor) |
| POST | `/auth/doctor/apply` | ✗ | Self-serve doctor application (account stays PENDING until admin approval) |
| POST | `/auth/refresh` | ✗ | Exchange a refresh token for a new access+refresh pair (single-use, rotating) |
| POST | `/auth/logout` | ✗ | Revoke a refresh token |

JWTs carry a `role` claim (`patient` or `doctor`); each portal's endpoints reject tokens from the other role.

**Sessions:** access tokens are short-lived (30 min) and silently renewed by all
clients via rotating refresh tokens (30 days). Refresh tokens are single-use -
replaying a rotated token is treated as theft and revokes every session for that
account. Changing a password revokes all sessions.

### Push Notifications (mobile)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/notifications/devices` | ✓ (any role) | Register this device's Expo push token |
| POST | `/notifications/devices/unregister` | ✓ (any role) | Stop pushes to this device (logout) |

Pushes are sent via the Expo Push API (no Firebase/APNs setup needed) for:
booking confirmations, day-before reminders, and severity-swap requests.
Failures never affect the triggering flow.

### Doctor Onboarding (Zocdoc-style: apply → verify → activate)

Doctors join through a credential-gated funnel - there is no self-serve go-live:

1. **Apply** - doctor submits name, specialization, qualification, medical license number, and password at `/apply` (frontend) or `POST /auth/doctor/apply`. The account is created as `PENDING`: invisible to patients, blocked from logging in, excluded from AI booking.
2. **Verify** - an admin reviews the application (license number shown for board verification) at `/admin/applications` or via `GET /doctors/applications`.
3. **Activate** - `PUT /doctors/{id}/application` with `{"action": "approve"}` (or `reject`). Approved doctors can immediately sign in and appear in patient search; rejected doctors are blocked from both.

Admin-created doctors (`POST /doctors/` with a `password`) skip the funnel and are `APPROVED` immediately. Doctors can rotate their password anytime via `PUT /doctor/me/password` (Settings page in the portal), so admins don't retain knowledge of doctor credentials.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/doctors/applications?application_status=` | ✓ (Admin) | List applications (default: PENDING) |
| PUT | `/doctors/{id}/application` | ✓ (Admin) | Approve or reject: `{"action": "approve" \| "reject"}` |
| POST | `/doctors/invite` | ✓ (Admin) | Invite a vetted doctor - emails a one-time set-password link (7-day expiry) |
| POST | `/doctors/{id}/verify-npi` | ✓ (Admin) | Check the doctor's NPI against the live CMS NPI Registry; stores VERIFIED / MISMATCH / NOT_FOUND |
| GET | `/hospitals/` | ✗ | List hospitals with approved-doctor counts |
| POST | `/hospitals/` | ✓ (Admin) | Create a hospital/clinic site |
| PUT | `/hospitals/{id}/assign/{doctor_id}` | ✓ (Admin) | Assign a doctor to a hospital |
| GET | `/auth/doctor/invite/{token}` | ✗ | Who the invite is for (drives the set-password page) |
| POST | `/auth/doctor/invite/{token}/accept` | ✗ | Set password, consume token, return signed-in portal JWT |
| PUT | `/doctor/me/password` | ✓ (Doctor) | Change portal password (requires current password) |

The invite path is the most secure onboarding route: the doctor chooses their own
password on a single-use link, so the admin never knows their credentials.

### AI Booking (Core Feature)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/inference/` | ✓ | Send a message; AI conducts intake, scores severity, and books appointment |

**Request:**
```json
{
  "message": "I have severe chest pain radiating to my left arm for 2 hours",
  "conversation_history": [],
  "collected_fields": {}
}
```

**Response:**
```json
{
  "message": "Your appointment has been booked!\n- Doctor: Dr. Ahmed (Cardiology)\n- Date & Time: 2026-04-07 at 09:00 AM\n- Severity: 5/5 - Symptoms consistent with acute cardiac event.",
  "is_appointment_booked": true,
  "appointment_id": 42,
  "severity_score": 5,
  "stage": "complete",
  "collected_fields": {},
  "urgent_guidance": "Call 911 immediately. Do not drive yourself. Chew an aspirin if you are not allergic. Stay calm and sit upright.\n\n⚠️ This is general guidance, not medical advice. Always consult a healthcare professional for proper diagnosis and treatment.",
  "guidance_type": "EMERGENCY"
}
```

Pass `conversation_history` and `collected_fields` from the previous response back on subsequent turns to maintain context.

### Doctors

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/doctors/` | ✗ | List doctors (filter: `specialization`, `availability_status`) |
| POST | `/doctors/` | ✓ (Admin) | Create doctor |
| GET | `/doctors/{id}` | ✗ | Get doctor by ID |
| PUT | `/doctors/{id}` | ✓ (Admin) | Update doctor |
| DELETE | `/doctors/{id}` | ✓ (Admin) | Delete doctor |

### Doctor Slots

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/slots/` | ✗ | List slots (filter: `doctor_id`, `slot_date`, `available_only`) |
| POST | `/slots/` | ✓ (Admin) | Create a slot |
| PUT | `/slots/{id}/close` | ✓ (Admin) | Manually close a slot |
| DELETE | `/slots/{id}` | ✓ (Admin) | Delete a slot |

**Slot creation example:**
```json
{
  "doctor_id": 1,
  "date": "2026-04-07",
  "start_time": "09:00:00",
  "duration_minutes": 30,
  "closes_before_minutes": 15
}
```

### Appointments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/appointments/` | ✓ | List my appointments |
| GET | `/appointments/upcoming` | ✓ | Get my upcoming appointments (chronological) |
| GET | `/appointments/{id}` | ✓ | Get appointment details |
| PUT | `/appointments/{id}/status` | ✓ | Update status: `COMPLETED` / `NO_SHOW` / `CANCELLED` |
| DELETE | `/appointments/{id}` | ✓ | Cancel appointment (frees the slot) |

### Rescheduling

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/reschedule/` | ✓ | View pending reschedule requests sent to me |
| POST | `/reschedule/{id}/accept` | ✓ | Accept → atomically swap slots between both patients |
| POST | `/reschedule/{id}/decline` | ✓ | Decline → keep original slot |

### Reviews (Verified)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/reviews/` | ✓ | Review a visit - only allowed if the doctor marked it `COMPLETED`; one per visit |
| GET | `/reviews/mine` | ✓ | My reviews (used to show "already rated" state) |
| GET | `/reviews/doctor/{id}` | ✗ | Public verified reviews + average rating for an approved doctor |

### Patient Profile

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/patients/me` | ✓ | Get my profile |
| PUT | `/patients/me` | ✓ | Update profile contact/medical details |

### Doctor Portal

All endpoints require a **doctor-role** JWT (from `/auth/doctor/login`).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/doctor/me` | My doctor profile |
| GET | `/doctor/briefing` | AI Morning Briefing: today's case mix + one-paragraph summary (cached per day) |
| GET | `/doctor/appointments?day=` | Day schedule with patient triage intel (defaults to today) |
| PUT | `/doctor/appointments/{id}/outcome` | Record visit outcome: `COMPLETED` / `NO_SHOW` |
| GET | `/doctor/slots?from_date=&to_date=` | My upcoming slots |
| POST | `/doctor/slots` | Add a single slot |
| POST | `/doctor/slots/bulk` | Generate recurring slots over a date range (idempotent - duplicates skipped) |
| PUT | `/doctor/slots/{id}/close` | Stop new bookings on a slot |
| DELETE | `/doctor/slots/{id}` | Delete an unbooked slot (409 if a patient is booked) |
| GET | `/doctor/reschedules` | Pending severity swaps affecting my calendar |
| GET | `/doctor/analytics?days=` | Practice insights: no-show rate, case mix by severity, busiest day (default 30-day window) |

**Bulk slot generation example:**
```json
{
  "start_date": "2026-06-15",
  "end_date": "2026-06-26",
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "duration_minutes": 30,
  "weekdays": [1, 2, 3, 4, 5]
}
```

> Visit outcomes (`COMPLETED` / `NO_SHOW`) can only be recorded by doctors.
> Patients can only cancel their own appointments.

### Health Status Check

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | ✗ | Check system health (FastAPI, Redis, and Database connections) |


---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- An OpenAI API key

### 1. Clone & configure

```bash
git clone https://github.com/HaziqAliSohail/CuraLine.git
cd CuraLine
```

Copy the example environment file and fill in real values:

```bash
cp Backend/.env.example Backend/.env
```

At minimum set `OPENAI_API_KEY`, a strong random `SECRET_KEY`, and a strong
`POSTGRES_PASSWORD` (generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`).
The app refuses to start with the default `SECRET_KEY` and warns on the default
database password.

### 2. Start the stack

```bash
docker compose --profile basic-setup up --build
```

This starts:
- `smart_appointment_web` - FastAPI on port 8080 (running non-root, rate-limited)
- `smart_appointment_web_worker` - Celery worker
- `redis` - Broker & result backend
- `postgresdb` - PostgreSQL database server
- `nginx` - Secure reverse proxy on ports 80/443

The startup script automatically applies Alembic database migrations.

### 3. Seed Mock Data

To seed the database with mock doctors, availabilities, slots, and test patient/admin accounts, execute the seeding script:

```bash
# Locally:
python seed.py

# In Docker:
docker exec -it smart_appointment_web python seed.py
```

Demo credentials created by the seed script:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@curaline.com` | `Admin@1234` |
| Patient | `john@example.com` | `Patient@1234` |
| Doctor (portal) | `sarah.jenkins@curaline.com` | `Doctor@1234` |

All four seeded doctors share the `Doctor@1234` portal password. On the login
page, use the **"I'm a Doctor"** toggle to access the doctor portal.

### 4. Verify

- Backend Swagger Docs: **http://localhost/docs** (or **http://localhost:8080/docs** if accessing direct)
- Health status check: **http://localhost/health**

### 5. Running the Frontend

To start the Vite dev server for the React frontend application:

```bash
# Navigate to the frontend directory
cd Frontend

# Install package dependencies
npm install

# Run the local development server
npm run dev
```

The application will launch at **http://localhost:3001** and automatically proxy `/v1` API requests to the backend at `http://localhost:8080`.

### 6. Running the Mobile App (iOS & Android)

A full React Native (Expo) client lives in [`Mobile/`](Mobile/README.md) with both
patient and doctor portals - AI booking chat, visits with verified reviews,
insurance-filtered doctor search, reschedule swaps, the doctor Morning Briefing
with one-tap outcomes, slot management, and practice insights.

```bash
cd Mobile
npm install
# Set your computer's LAN IP in src/config.js (phones can't reach localhost)
npx expo start
```

Scan the QR code with the **Expo Go** app (App Store / Play Store) on a phone
connected to the same Wi-Fi. Full setup details, troubleshooting, and demo
credentials: [Mobile/README.md](Mobile/README.md).

### 7. Enabling HTTPS (production)

The stack ships with a TLS-ready nginx config (`Backend/nginx/nginx.prod.conf`)
that redirects all HTTP traffic to HTTPS, enables HSTS, and keeps the ACME
challenge path open for certificate renewal.

**Staging / testing without a domain:** generate a self-signed certificate in
one command, then switch nginx to the TLS config:

```bash
./Backend/scripts/gen-self-signed-cert.sh            # or .ps1 on Windows
```

**Production** (mobile releases require a real certificate - iOS/Android block
both plaintext HTTP and self-signed certs):

1. Obtain a certificate for your domain (e.g. with certbot on the host):
   ```bash
   certbot certonly --standalone -d api.yourdomain.com
   ```
2. Copy (or bind-mount) the certificate into the certs directory:
   ```bash
   cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem Backend/nginx/certs/
   cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem  Backend/nginx/certs/
   ```
3. Switch nginx to the TLS config in `Backend/.env`:
   ```env
   NGINX_CONF=nginx.prod.conf
   ```
4. Recreate the proxy: `docker compose --profile basic-setup up -d --force-recreate nginx`

> Certificates are gitignored - nothing under `Backend/nginx/certs/` is ever committed.

---

## Severity Scale

| Score | Level | Meaning |
|---|---|---|
| 1 | Routine | Minor issue, can wait days/weeks |
| 2 | Low | Should be seen within a week |
| 3 | Moderate | Should be seen within 1–3 days |
| 4 | High | Should be seen today - urgent |
| 5 | Critical | Emergency; may redirect to ER |

When a patient scores **4 or 5**, the system automatically sends reschedule requests to the 3 least-critical patients in the earliest available slots, asking them to move so the urgent patient can be seen sooner.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used for intake and severity analysis |
| `ANTHROPIC_API_KEY` | *(optional)* | Anthropic API key for fallback LLM |
| `ANTHROPIC_MODEL` | `claude-haiku-4.5-20250514` | Anthropic fallback model |
| `LLM_PRIMARY` | `openai` | Which provider to try first: `openai` or `anthropic` |
| `LLM_MAX_TOKENS` | `512` | Hard cap on output tokens per LLM call (cost control) |
| `SECRET_KEY` | `changeme-...` | JWT signing secret - **change in production** |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token TTL (clients renew silently) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Rotating refresh token lifetime |
| `POSTGRES_HOST` | `postgresdb` | PostgreSQL host |
| `POSTGRES_USER` | `admin` | PostgreSQL user (set a custom one in `.env`) |
| `POSTGRES_PASSWORD` | `admin` | PostgreSQL password - **set a strong value in production** |
| `NGINX_CONF` | `nginx.conf` | Nginx config file: `nginx.prod.conf` enables TLS |
| `POSTGRES_NAME` | `appointment_management` | Database name |
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed CORS origins |
| `SMTP_HOST` | *(empty - disabled)* | SMTP relay host; empty = emails logged, not sent |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` / `SMTP_PASSWORD` | *(empty)* | SMTP credentials (optional for open relays) |
| `SMTP_USE_TLS` | `True` | STARTTLS on the SMTP connection |
| `EMAIL_FROM` | `CuraLine <no-reply@curaline.com>` | From header on all outgoing email |
| `USE_SQLITE` | `False` | Set to `True` to use SQLite locally without Postgres |


---

## Database Schema

```
patients
  id, name, gender, phone, email, password_hash, is_admin,
  medical_history, last_visit_date, created_at, updated_at

doctors
  id, name, gender, phone, email, password_hash, specialization,
  qualification, availability_status, consultation_fee, reporting_time,
  leaving_time, rating, created_at, updated_at

doctor_slots
  id, doctor_id → doctors, date, start_time, duration_minutes,
  closes_before_minutes, is_available, created_at, updated_at

appointments
  id, patient_id → patients, doctor_id → doctors, slot_id → doctor_slots,
  status, reason, severity_score, reschedule_requested,
  created_at, updated_at

reschedule_requests
  id, triggering_appointment_id → appointments,
  target_appointment_id → appointments,
  proposed_slot_id → doctor_slots,
  status (PENDING/ACCEPTED/DECLINED), created_at, updated_at
```
