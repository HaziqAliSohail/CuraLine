"""Integration tests for authentication endpoints."""
import pytest


class TestRegisterEndpoint:
    def test_register_success(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "New User",
            "gender": "FEMALE",
            "phone": "5551234567",
            "email": "newuser@test.com",
            "password": "securepass1",
            "medical_history": "None",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New User"
        assert data["email"] == "newuser@test.com"
        assert "password" not in data
        assert "password_hash" not in data

    def test_register_duplicate_email(self, client, sample_patient):
        resp = client.post("/v1/auth/register", json={
            "name": "Duplicate",
            "gender": "MALE",
            "email": "patient@test.com",  # already exists
            "password": "securepass1",
        })
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"]

    def test_register_missing_required_fields(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "Incomplete",
        })
        assert resp.status_code == 422

    def test_register_invalid_gender(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "Bad Gender",
            "gender": "ALIEN",
            "email": "alien@test.com",
            "password": "securepass1",
        })
        assert resp.status_code == 422

    def test_register_short_password(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "Short Pass",
            "gender": "MALE",
            "email": "short@test.com",
            "password": "short",
        })
        assert resp.status_code == 422

    def test_register_invalid_email(self, client):
        resp = client.post("/v1/auth/register", json={
            "name": "Bad Email",
            "gender": "MALE",
            "email": "not-an-email",
            "password": "securepass1",
        })
        assert resp.status_code == 422


class TestLoginEndpoint:
    def test_login_success(self, client, sample_patient):
        resp = client.post("/v1/auth/login", json={
            "email": "patient@test.com",
            "password": "securepass1",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, sample_patient):
        resp = client.post("/v1/auth/login", json={
            "email": "patient@test.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email(self, client):
        resp = client.post("/v1/auth/login", json={
            "email": "ghost@test.com",
            "password": "anything123",
        })
        assert resp.status_code == 401

    def test_login_returns_valid_jwt(self, client, sample_patient):
        resp = client.post("/v1/auth/login", json={
            "email": "patient@test.com",
            "password": "securepass1",
        })
        token = resp.json()["access_token"]
        # Use token to access protected endpoint
        profile_resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert profile_resp.status_code == 200
        assert profile_resp.json()["email"] == "patient@test.com"


class TestPatientMeEndpoint:
    def test_me_authenticated(self, client, auth_header):
        resp = client.get("/v1/patients/me", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Patient"

    def test_me_no_token(self, client):
        resp = client.get("/v1/patients/me")
        assert resp.status_code == 401

    def test_me_invalid_token(self, client):
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401

    def test_me_expired_token(self, client, db):
        """Craft an expired token and check it's rejected."""
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from settings import settings

        expired_payload = {
            "sub": "1",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        }
        expired_token = jwt.encode(expired_payload, settings.secret_key, algorithm=settings.algorithm)
        resp = client.get(
            "/v1/patients/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert resp.status_code == 401
