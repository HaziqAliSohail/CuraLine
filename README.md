# CuraLine — Smart Hospital Appointment System

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

- **Conversational AI booking** — patients describe their condition in natural language; the system handles the rest
- **Severity-first scheduling** — appointments are ranked 1–5 (routine → critical); critical patients surface to earlier slots
- **Dynamic rescheduling** — when a critical patient books, the system politely asks lower-priority patients in the earliest slots to switch; they can accept or decline
- **Doctor slot management** — doctors define their daily schedule with precise time slots and a configurable booking close window (e.g. "close this slot 15 min before start")
- **Automatic slot expiry** — a background worker closes slots that have passed their booking window
- **JWT authentication** — patients register and log in; all booking endpoints are protected

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI (Python 3.12) |
| Database | PostgreSQL + SQLAlchemy ORM |
| Migrations | Alembic |
| Task queue | Celery + Redis |
| AI / LLM | OpenAI gpt-4o |
| Auth | passlib (bcrypt) + python-jose (JWT) |
| Web server | Uvicorn behind Nginx |
| Containers | Docker + Docker Compose |

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
│   ├── __init__.py                # Instantiates llm_client from settings
│   ├── llmclient.py               # LLMClient (query + query_structured)
│   ├── mapper.py                  # LLM provider map (OpenAI, extensible)
│   └── prompts.py                 # System prompts: intake + severity analysis
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
| POST | `/auth/login` | ✗ | Login → returns JWT token |

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
  "message": "Your appointment has been booked!\n- Doctor: Dr. Ahmed (Cardiology)\n- Date & Time: 2026-04-07 at 09:00 AM\n- Severity: 5/5 — Symptoms consistent with acute cardiac event.",
  "is_appointment_booked": true,
  "appointment_id": 42,
  "severity_score": 5,
  "stage": "complete",
  "collected_fields": {}
}
```

Pass `conversation_history` and `collected_fields` from the previous response back on subsequent turns to maintain context.

### Doctors

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/doctors/` | ✗ | List doctors (filter: `specialization`, `availability_status`) |
| POST | `/doctors/` | ✗ | Create doctor |
| GET | `/doctors/{id}` | ✗ | Get doctor by ID |
| PUT | `/doctors/{id}` | ✗ | Update doctor |
| DELETE | `/doctors/{id}` | ✗ | Delete doctor |

### Doctor Slots

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/slots/` | ✗ | List slots (filter: `doctor_id`, `slot_date`, `available_only`) |
| POST | `/slots/` | ✗ | Create a slot |
| PUT | `/slots/{id}/close` | ✗ | Manually close a slot |
| DELETE | `/slots/{id}` | ✗ | Delete a slot |

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
| GET | `/appointments/{id}` | ✓ | Get appointment details |
| PUT | `/appointments/{id}/status` | ✓ | Update status: `COMPLETED` / `NO_SHOW` / `CANCELLED` |
| DELETE | `/appointments/{id}` | ✓ | Cancel appointment (frees the slot) |

### Rescheduling

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/reschedule/` | ✓ | View pending reschedule requests sent to me |
| POST | `/reschedule/{id}/accept` | ✓ | Accept → swap to proposed slot |
| POST | `/reschedule/{id}/decline` | ✓ | Decline → keep original slot |

### Patient Profile

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/patients/me` | ✓ | Get my profile |

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

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
SECRET_KEY=your-strong-random-secret
```

### 2. Start the stack

```bash
docker compose --profile basic-setup up --build
```

This starts:
- `smart_appointment_web` — FastAPI on port 8080
- `smart_appointment_web_worker` — Celery worker
- `redis` — broker & result backend
- `postgresdb` — PostgreSQL
- `nginx` — reverse proxy on ports 80/443

The web startup script automatically runs `alembic upgrade head` before starting Uvicorn.

### 3. Verify

Visit **http://localhost/docs** for the interactive Swagger UI.

---

## Severity Scale

| Score | Level | Meaning |
|---|---|---|
| 1 | Routine | Minor issue, can wait days/weeks |
| 2 | Low | Should be seen within a week |
| 3 | Moderate | Should be seen within 1–3 days |
| 4 | High | Should be seen today — urgent |
| 5 | Critical | Emergency; may redirect to ER |

When a patient scores **4 or 5**, the system automatically sends reschedule requests to the 3 least-critical patients in the earliest available slots, asking them to move so the urgent patient can be seen sooner.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | Model used for intake and severity analysis |
| `SECRET_KEY` | `changeme-...` | JWT signing secret — **change in production** |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token TTL (24 hours) |
| `POSTGRES_HOST` | `postgresdb` | PostgreSQL host |
| `POSTGRES_USER` | `admin` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `admin` | PostgreSQL password |
| `POSTGRES_NAME` | `appointment_management` | Database name |
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

---

## Database Schema

```
patients
  id, name, gender, phone, email, password_hash,
  medical_history, last_visit_date, created_at, updated_at

doctors
  id, name, gender, phone, email, specialization, qualification,
  availability_status, consultation_fee, reporting_time, leaving_time,
  rating, created_at, updated_at

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
