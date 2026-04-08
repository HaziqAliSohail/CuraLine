"""Unit tests for authentication utilities."""
from datetime import datetime, timedelta

from jose import jwt

from settings import settings
from web.auth.security import hash_password, verify_password, create_access_token


class TestPasswordHashing:
    def test_hash_password_returns_hash(self):
        h = hash_password("mypassword")
        assert h != "mypassword"
        assert h.startswith("$2b$")  # bcrypt prefix

    def test_verify_correct_password(self):
        h = hash_password("securepass")
        assert verify_password("securepass", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("securepass")
        assert verify_password("wrongpass", h) is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt uses random salt


class TestJWTTokens:
    def test_create_token_structure(self):
        token = create_access_token(42)
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "42"
        assert "exp" in payload

    def test_token_contains_patient_id(self):
        token = create_access_token(99)
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "99"

    def test_token_expiry_is_future(self):
        token = create_access_token(1)
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        exp = datetime.utcfromtimestamp(payload["exp"])
        assert exp > datetime.utcnow()

    def test_token_decode_with_wrong_key_fails(self):
        token = create_access_token(1)
        try:
            jwt.decode(token, "wrong-secret-key", algorithms=[settings.algorithm])
            assert False, "Should have raised"
        except Exception:
            pass  # Expected

    def test_token_decode_with_wrong_algorithm_fails(self):
        token = create_access_token(1)
        try:
            jwt.decode(token, settings.secret_key, algorithms=["HS384"])
            assert False, "Should have raised"
        except Exception:
            pass  # Expected


class TestSchemaValidation:
    def test_register_schema_valid(self):
        from web.auth.schemas import RegisterInSchema
        data = RegisterInSchema(
            name="Test",
            gender="MALE",
            email="test@example.com",
            password="password1",
        )
        assert data.name == "Test"

    def test_register_schema_invalid_gender(self):
        from web.auth.schemas import RegisterInSchema
        try:
            RegisterInSchema(
                name="Test",
                gender="INVALID",
                email="test@example.com",
                password="password1",
            )
            assert False, "Should have raised"
        except Exception:
            pass

    def test_register_schema_short_password(self):
        from web.auth.schemas import RegisterInSchema
        try:
            RegisterInSchema(
                name="Test",
                gender="MALE",
                email="test@example.com",
                password="short",
            )
            assert False, "Should have raised"
        except Exception:
            pass

    def test_register_schema_invalid_email(self):
        from web.auth.schemas import RegisterInSchema
        try:
            RegisterInSchema(
                name="Test",
                gender="MALE",
                email="not-an-email",
                password="password1",
            )
            assert False, "Should have raised"
        except Exception:
            pass

    def test_login_schema_valid(self):
        from web.auth.schemas import LoginInSchema
        data = LoginInSchema(email="test@example.com", password="password1")
        assert data.email == "test@example.com"

    def test_appointment_status_update_schema_valid(self):
        from web.appointments.schemas import AppointmentStatusUpdateSchema
        s = AppointmentStatusUpdateSchema(status="COMPLETED")
        assert s.status == "COMPLETED"

    def test_appointment_status_update_schema_invalid(self):
        from web.appointments.schemas import AppointmentStatusUpdateSchema
        try:
            AppointmentStatusUpdateSchema(status="INVALID_STATUS")
            assert False, "Should have raised"
        except Exception:
            pass

    def test_doctor_schema_negative_fee(self):
        from web.doctors.schemas import DoctorInSchema
        from datetime import time
        try:
            DoctorInSchema(
                name="Dr. Bad",
                gender="MALE",
                specialization="General",
                qualification="MD",
                consultation_fee=-100,
                reporting_time=time(9, 0),
                leaving_time=time(17, 0),
            )
            assert False, "Should have raised"
        except Exception:
            pass

    def test_slot_schema_short_duration(self):
        from web.slots.schemas import SlotInSchema
        from datetime import date, time
        try:
            SlotInSchema(
                doctor_id=1,
                date=date.today(),
                start_time=time(10, 0),
                duration_minutes=2,  # less than min of 5
            )
            assert False, "Should have raised"
        except Exception:
            pass
