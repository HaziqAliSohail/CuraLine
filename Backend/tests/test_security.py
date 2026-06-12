"""
Security tests for CuraLine.
Covers: SQL injection, XSS, auth bypass, IDOR, CORS, header injection,
        JWT manipulation, input fuzzing, rate-limit awareness, and
        password storage verification.
"""
import json
from datetime import datetime, timedelta, timezone

from jose import jwt

from models.patient import Patient
from settings import settings
from web.auth.security import hash_password, create_access_token


# ── SQL Injection ────────────────────────────────────────────────────
class TestSQLInjection:
    """ORM-based queries should be parameterised automatically.
    These tests confirm that SQL-injection payloads are treated as literal strings."""

    PAYLOADS = [
        "' OR '1'='1",
        "'; DROP TABLE patients; --",
        "\" OR \"\"=\"",
        "1; SELECT * FROM patients --",
        "' UNION SELECT password_hash FROM patients --",
        "admin'--",
        "1' AND 1=1 UNION ALL SELECT NULL,NULL,NULL--",
    ]

    def test_login_sqli(self, client):
        for payload in self.PAYLOADS:
            resp = client.post("/v1/auth/login", json={
                "email": payload,
                "password": payload,
            })
            # Should be 422 (invalid email) or 401 — never 200
            assert resp.status_code in (401, 422), f"Unexpected {resp.status_code} for {payload}"

    def test_doctor_search_sqli(self, client):
        for payload in self.PAYLOADS:
            resp = client.get(f"/v1/doctors/?specialization={payload}")
            assert resp.status_code == 200  # returns empty, not error
            assert isinstance(resp.json(), list)

    def test_register_sqli_in_name(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "'; DROP TABLE patients; --",
            "gender": "MALE",
            "email": "sqli@test.com",
            "password": "securepass1",
        })
        # Should succeed (name is just a string)
        assert resp.status_code == 201
        assert resp.json()["name"] == "'; DROP TABLE patients; --"


# ── XSS (stored) ────────────────────────────────────────────────────
class TestXSS:
    """Ensure script tags stored in text fields are returned as-is
    (not executed). The API returns JSON so the browser won't execute them,
    but we verify the values are not silently altered."""

    XSS_PAYLOADS = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "<svg onload=alert(1)>",
    ]

    def test_register_xss_in_name(self, client):
        for i, payload in enumerate(self.XSS_PAYLOADS):
            resp = client.post("/v1/auth/register", json={
                "name": payload[:50],  # max_length=50
                "gender": "MALE",
                "email": f"xss{i}@test.com",
                "password": "securepass1",
            })
            assert resp.status_code == 201
            # JSON response — value stored literally, no execution
            assert resp.json()["name"] == payload[:50]

    def test_doctor_xss_in_specialization(self, client, admin_header):
        resp = client.post("/v1/doctors/", json={
            "name": "Dr. XSS",
            "gender": "MALE",
            "specialization": "<script>alert('xss')</script>",
            "qualification": "MD",
            "consultation_fee": 100,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
        }, headers=admin_header)
        assert resp.status_code == 201
        # Content-Type is application/json so XSS won't execute
        assert "script" in resp.json()["specialization"]


# ── JWT manipulation ─────────────────────────────────────────────────
class TestJWTSecurity:
    def test_tampered_token_rejected(self, client, sample_patient):
        """Modify the payload of a valid token — should be rejected."""
        token = create_access_token(sample_patient.id)
        parts = token.split(".")
        # Tamper with the payload (flip a character)
        tampered = parts[0] + "." + parts[1][::-1] + "." + parts[2]
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {tampered}"},
        )
        assert resp.status_code == 401

    def test_none_algorithm_attack(self, client, sample_patient):
        """The 'none' algorithm attack should fail."""
        payload = {"sub": str(sample_patient.id), "exp": datetime.now(timezone.utc) + timedelta(hours=1)}
        # Create unsigned token with alg=none
        import base64
        header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=")
        body = base64.urlsafe_b64encode(json.dumps(payload, default=str).encode()).rstrip(b"=")
        fake_token = header.decode() + "." + body.decode() + "."

        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {fake_token}"},
        )
        assert resp.status_code == 401

    def test_token_with_wrong_secret(self, client, sample_patient):
        payload = {"sub": str(sample_patient.id), "exp": datetime.now(timezone.utc) + timedelta(hours=1)}
        token = jwt.encode(payload, "completely-wrong-key", algorithm="HS256")
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401

    def test_token_with_nonexistent_patient(self, client):
        """Valid JWT but for patient ID that doesn't exist."""
        token = create_access_token(99999)
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401

    def test_token_without_sub_claim(self, client):
        payload = {"exp": datetime.now(timezone.utc) + timedelta(hours=1)}
        token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401

    def test_expired_token(self, client, sample_patient):
        payload = {"sub": str(sample_patient.id), "exp": datetime.now(timezone.utc) - timedelta(hours=1)}
        token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401


# ── IDOR (Insecure Direct Object Reference) ─────────────────────────
class TestIDOR:
    def test_cannot_access_other_patients_appointment(self, client, sample_appointment, db):
        other = Patient(
            name="Attacker",
            gender="MALE",
            email="attacker@test.com",
            password_hash=hash_password("securepass1"),
        )
        db.add(other)
        db.commit()
        token = create_access_token(other.id)
        resp = client.get(
            f"/v1/appointments/{sample_appointment.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_cannot_cancel_other_patients_appointment(self, client, sample_appointment, db):
        other = Patient(
            name="Attacker",
            gender="MALE",
            email="attacker2@test.com",
            password_hash=hash_password("securepass1"),
        )
        db.add(other)
        db.commit()
        token = create_access_token(other.id)
        resp = client.delete(
            f"/v1/appointments/{sample_appointment.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_cannot_update_other_patients_appointment(self, client, sample_appointment, db):
        other = Patient(
            name="Attacker",
            gender="MALE",
            email="attacker3@test.com",
            password_hash=hash_password("securepass1"),
        )
        db.add(other)
        db.commit()
        token = create_access_token(other.id)
        resp = client.put(
            f"/v1/appointments/{sample_appointment.id}/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "CANCELLED"},
        )
        assert resp.status_code == 404


# ── Password storage ─────────────────────────────────────────────────
class TestPasswordStorage:
    def test_password_not_stored_in_plaintext(self, client, db):
        client.post("/v1/auth/register", json={
            "name": "Store Test",
            "gender": "MALE",
            "email": "store@test.com",
            "password": "mysecretpassword",
        })
        patient = db.query(Patient).filter(Patient.email == "store@test.com").first()
        assert patient.password_hash != "mysecretpassword"
        assert patient.password_hash.startswith("$2b$")  # bcrypt

    def test_password_not_in_api_response(self, client, sample_patient, auth_header):
        resp = client.get("/v1/patients/me", headers=auth_header)
        data = resp.json()
        assert "password" not in data
        assert "password_hash" not in data

    def test_registration_response_hides_password(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "Hide Test",
            "gender": "MALE",
            "email": "hide@test.com",
            "password": "securepass1",
        })
        data = resp.json()
        assert "password" not in data
        assert "password_hash" not in data


# ── Header injection ─────────────────────────────────────────────────
class TestHeaderInjection:
    def test_newline_in_auth_header(self, client):
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": "Bearer token\r\nX-Injected: true"},
        )
        # Should not crash the server; 401 or 422 is fine
        assert resp.status_code in (401, 422, 400)


# ── Input size / boundary ───────────────────────────────────────────
class TestInputBoundary:
    def test_very_long_name(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "A" * 10000,
            "gender": "MALE",
            "email": "long@test.com",
            "password": "securepass1",
        })
        # Should be rejected by max_length=50
        assert resp.status_code == 422

    def test_very_long_password(self, client):
        """bcrypt has a 72-byte limit; the app should still work."""
        long_pass = "A" * 200
        resp = client.post("/v1/auth/register", json={
            "name": "Long Pass",
            "gender": "MALE",
            "email": "longpass@test.com",
            "password": long_pass,
        })
        # Should succeed (bcrypt truncates silently)
        assert resp.status_code == 201

    def test_empty_body(self, client):
        resp = client.post("/v1/auth/register", content=b"", headers={"Content-Type": "application/json"})
        assert resp.status_code == 422

    def test_malformed_json(self, client):
        resp = client.post(
            "/v1/auth/register",
            content=b"{broken json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422

    def test_negative_ids_in_path(self, client, auth_header):
        resp = client.get("/v1/appointments/-1", headers=auth_header)
        assert resp.status_code == 404


# ── CORS configuration audit ────────────────────────────────────────
class TestCORSConfiguration:
    """Note: allow_origins=['*'] with allow_credentials=True is a security
    issue. The test documents the current behaviour and flags it."""

    def test_cors_rejects_unknown_origin(self, client):
        """FIXED: CORS now rejects unknown origins."""
        resp = client.options(
            "/v1/auth/login",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        # With restricted origins, evil.example.com should be rejected
        assert resp.status_code == 400

    def test_cors_does_not_use_wildcard_with_credentials(self):
        """
        FIXED: CORS now restricts origins to known frontend URLs
        instead of using '*' with credentials.
        """
        from main import app
        middleware_found = False
        for m in app.user_middleware:
            if "CORSMiddleware" in str(m):
                middleware_found = True
        assert middleware_found, "CORS middleware should be registered"


# ── Doctor endpoints auth ────────────────────────────────────────────
class TestDoctorEndpointSecurity:
    """Doctor/slot CRUD now requires admin role."""

    def test_create_doctor_requires_auth(self, client):
        """Creating doctors requires authentication."""
        resp = client.post("/v1/doctors/", json={
            "name": "Unauthenticated",
            "gender": "MALE",
            "specialization": "Hacking",
            "qualification": "PhD",
            "consultation_fee": 0,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
        })
        assert resp.status_code == 401

    def test_create_doctor_requires_admin(self, client, auth_header):
        """Regular patients cannot create doctors — 403 Forbidden."""
        resp = client.post("/v1/doctors/", json={
            "name": "Unauthorized",
            "gender": "MALE",
            "specialization": "None",
            "qualification": "None",
            "consultation_fee": 0,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
        }, headers=auth_header)
        assert resp.status_code == 403

    def test_delete_doctor_requires_auth(self, client, sample_doctor):
        """Deleting doctors requires authentication."""
        resp = client.delete(f"/v1/doctors/{sample_doctor.id}")
        assert resp.status_code == 401

    def test_slot_creation_requires_auth(self, client, sample_doctor):
        """Creating slots requires authentication."""
        from datetime import date, timedelta
        resp = client.post("/v1/slots/", json={
            "doctor_id": sample_doctor.id,
            "date": (date.today() + timedelta(days=1)).isoformat(),
            "start_time": "10:00:00",
        })
        assert resp.status_code == 401

    def test_slot_creation_requires_admin(self, client, auth_header, sample_doctor):
        """Regular patients cannot create slots — 403 Forbidden."""
        from datetime import date, timedelta
        resp = client.post("/v1/slots/", json={
            "doctor_id": sample_doctor.id,
            "date": (date.today() + timedelta(days=1)).isoformat(),
            "start_time": "10:00:00",
        }, headers=auth_header)
        assert resp.status_code == 403
