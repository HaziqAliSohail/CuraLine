"""
Shared fixtures for CuraLine test suite.
Uses an in-memory SQLite database so tests run without PostgreSQL.
"""
import os, sys
from datetime import date, time, datetime, timedelta

# Ensure project root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Override settings BEFORE any app import
os.environ["POSTGRES_HOST"] = "localhost"
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["TESTING"] = "True"
# Use a strong test secret so the startup validation guard is satisfied
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-tests-to-pass-ok"

import pytest
from sqlalchemy import create_engine, event, Enum as SAEnum, String
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from database.db import Base, get_db_session
from main import app
from models.patient import Patient
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from models.appointment import Appointment
from models.reschedule_request import RescheduleRequest
from web.auth.security import hash_password, create_access_token

# ── Compile Enum as VARCHAR on SQLite ────────────────────────────────
from sqlalchemy.ext.compiler import compiles

@compiles(SAEnum, "sqlite")
def _compile_enum_sqlite(element, compiler, **kw):
    return compiler.visit_VARCHAR(String(50), **kw)


# ── SQLite in-memory engine ──────────────────────────────────────────
engine = create_engine(
    "sqlite:///:memory:",
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSession = sessionmaker(bind=engine, class_=Session)


# ── Session fixture ──────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def db():
    """Create tables, yield a session, then tear down."""
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ── FastAPI test client ──────────────────────────────────────────────
@pytest.fixture()
def client(db):
    """TestClient with DB session override."""
    def _override():
        try:
            yield db
        finally:
            pass  # managed by the db fixture

    app.dependency_overrides[get_db_session] = _override
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Seed helpers ─────────────────────────────────────────────────────
@pytest.fixture()
def sample_patient(db):
    p = Patient(
        name="Test Patient",
        gender="MALE",
        phone="1234567890",
        email="patient@test.com",
        password_hash=hash_password("securepass1"),
        medical_history="No known allergies",
        is_admin=False,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture()
def sample_admin(db):
    p = Patient(
        name="Admin User",
        gender="MALE",
        email="admin@test.com",
        password_hash=hash_password("securepass1"),
        is_admin=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture()
def patient_token(sample_patient):
    return create_access_token(sample_patient.id)


@pytest.fixture()
def admin_token(sample_admin):
    return create_access_token(sample_admin.id)


@pytest.fixture()
def auth_header(patient_token):
    return {"Authorization": f"Bearer {patient_token}"}


@pytest.fixture()
def admin_header(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def sample_doctor(db):
    d = Doctor(
        name="Dr. Smith",
        gender="MALE",
        phone="9876543210",
        email="smith@hospital.com",
        specialization="Cardiology",
        qualification="MD, DM Cardiology",
        availability_status="AVAILABLE",
        consultation_fee=250.00,
        reporting_time=time(9, 0),
        leaving_time=time(17, 0),
        rating=5,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@pytest.fixture()
def sample_slot(db, sample_doctor):
    s = DoctorSlot(
        doctor_id=sample_doctor.id,
        date=date.today() + timedelta(days=1),
        start_time=time(10, 0),
        duration_minutes=30,
        closes_before_minutes=15,
        is_available=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture()
def sample_appointment(db, sample_patient, sample_doctor, sample_slot):
    a = Appointment(
        patient_id=sample_patient.id,
        doctor_id=sample_doctor.id,
        slot_id=sample_slot.id,
        status=Appointment.SCHEDULED,
        reason="Chest pain",
        severity_score=2,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a
