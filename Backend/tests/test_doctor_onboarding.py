"""Tests for the doctor onboarding flow: self-serve application → admin
verification → activation, plus the doctor change-password endpoint."""
from datetime import time

import pytest

from models.doctor import Doctor
from web.auth.security import ROLE_DOCTOR, create_access_token, hash_password


APPLICATION = {
    "name": "Dr. Applicant",
    "gender": "FEMALE",
    "email": "applicant@newdoc.com",
    "password": "applicantpass1",
    "specialization": "Dermatology",
    "qualification": "MD Dermatology",
    "license_number": "LIC-99887",
}


def _apply(client, **overrides):
    return client.post("/v1/auth/doctor/apply", json={**APPLICATION, **overrides})


class TestDoctorApplication:
    def test_apply_creates_pending_account(self, client, db):
        resp = _apply(client)
        assert resp.status_code == 201
        body = resp.json()
        assert body["application_status"] == "PENDING"

        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()
        assert doctor.application_status == Doctor.PENDING
        assert doctor.license_number == "LIC-99887"
        assert doctor.password_hash != APPLICATION["password"]  # hashed

    def test_pending_doctor_cannot_login(self, client):
        _apply(client)
        resp = client.post(
            "/v1/auth/doctor/login",
            json={"email": APPLICATION["email"], "password": APPLICATION["password"]},
        )
        assert resp.status_code == 403
        assert "under review" in resp.json()["detail"].lower()

    def test_pending_doctor_invisible_to_patients(self, client, db):
        _apply(client)
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()

        listing = client.get("/v1/doctors/")
        assert doctor.id not in [d["id"] for d in listing.json()]

        detail = client.get(f"/v1/doctors/{doctor.id}")
        assert detail.status_code == 404

    def test_duplicate_application_rejected(self, client):
        assert _apply(client).status_code == 201
        assert _apply(client).status_code == 409

    def test_application_requires_license_number(self, client):
        resp = client.post("/v1/auth/doctor/apply", json={
            k: v for k, v in APPLICATION.items() if k != "license_number"
        })
        assert resp.status_code == 422


class TestAdminReview:
    def test_admin_sees_pending_applications(self, client, admin_header, db):
        _apply(client)
        resp = client.get("/v1/doctors/applications", headers=admin_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["email"] == APPLICATION["email"]
        assert data[0]["license_number"] == "LIC-99887"
        assert data[0]["application_status"] == "PENDING"

    def test_non_admin_cannot_review(self, client, auth_header, db):
        _apply(client)
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()
        assert client.get("/v1/doctors/applications", headers=auth_header).status_code == 403
        assert client.put(
            f"/v1/doctors/{doctor.id}/application",
            headers=auth_header,
            json={"action": "approve"},
        ).status_code == 403

    def test_approve_activates_account(self, client, admin_header, db):
        _apply(client)
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()

        resp = client.put(
            f"/v1/doctors/{doctor.id}/application",
            headers=admin_header,
            json={"action": "approve"},
        )
        assert resp.status_code == 200
        assert resp.json()["application_status"] == "APPROVED"

        # Can now log in
        login = client.post(
            "/v1/auth/doctor/login",
            json={"email": APPLICATION["email"], "password": APPLICATION["password"]},
        )
        assert login.status_code == 200

        # Now visible to patients
        listing = client.get("/v1/doctors/")
        assert doctor.id in [d["id"] for d in listing.json()]

    def test_reject_blocks_login_and_listing(self, client, admin_header, db):
        _apply(client)
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()

        client.put(
            f"/v1/doctors/{doctor.id}/application",
            headers=admin_header,
            json={"action": "reject"},
        )

        login = client.post(
            "/v1/auth/doctor/login",
            json={"email": APPLICATION["email"], "password": APPLICATION["password"]},
        )
        assert login.status_code == 403
        assert "not approved" in login.json()["detail"].lower()

        listing = client.get("/v1/doctors/")
        assert doctor.id not in [d["id"] for d in listing.json()]

    def test_cannot_decide_twice(self, client, admin_header, db):
        _apply(client)
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()
        url = f"/v1/doctors/{doctor.id}/application"
        assert client.put(url, headers=admin_header, json={"action": "approve"}).status_code == 200
        assert client.put(url, headers=admin_header, json={"action": "reject"}).status_code == 409

    def test_invalid_action_rejected(self, client, admin_header, db):
        _apply(client)
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()
        resp = client.put(
            f"/v1/doctors/{doctor.id}/application",
            headers=admin_header,
            json={"action": "maybe"},
        )
        assert resp.status_code == 422


class TestDoctorChangePassword:
    @pytest.fixture()
    def active_doctor(self, db):
        d = Doctor(
            name="Dr. Rotate",
            gender="MALE",
            email="rotate@hospital.com",
            specialization="Cardiology",
            qualification="MD",
            availability_status="AVAILABLE",
            application_status=Doctor.APPROVED,
            consultation_fee=100.00,
            reporting_time=time(9, 0),
            leaving_time=time(17, 0),
            password_hash=hash_password("originalpass1"),
        )
        db.add(d)
        db.commit()
        db.refresh(d)
        return d

    @pytest.fixture()
    def rotate_header(self, active_doctor):
        token = create_access_token(active_doctor.id, role=ROLE_DOCTOR)
        return {"Authorization": f"Bearer {token}"}

    def test_change_password_success(self, client, rotate_header, active_doctor):
        resp = client.put("/v1/doctor/me/password", headers=rotate_header, json={
            "current_password": "originalpass1",
            "new_password": "rotatedpass2",
        })
        assert resp.status_code == 204

        old = client.post("/v1/auth/doctor/login", json={
            "email": "rotate@hospital.com", "password": "originalpass1",
        })
        assert old.status_code == 401

        new = client.post("/v1/auth/doctor/login", json={
            "email": "rotate@hospital.com", "password": "rotatedpass2",
        })
        assert new.status_code == 200

    def test_change_password_wrong_current(self, client, rotate_header):
        resp = client.put("/v1/doctor/me/password", headers=rotate_header, json={
            "current_password": "wrongpass99",
            "new_password": "rotatedpass2",
        })
        assert resp.status_code == 403

    def test_change_password_too_short(self, client, rotate_header):
        resp = client.put("/v1/doctor/me/password", headers=rotate_header, json={
            "current_password": "originalpass1",
            "new_password": "short",
        })
        assert resp.status_code == 422


class TestPlatformAdminIdentity:
    def test_patient_me_is_never_admin(self, client, auth_header):
        # is_admin is retained on the patient schema (legacy) but admins are now a
        # separate identity (PlatformAdmin), so patients are never admins.
        patient = client.get("/v1/patients/me", headers=auth_header).json()
        assert patient["is_admin"] is False

    def test_admin_login_issues_admin_token(self, client, sample_admin):
        res = client.post("/v1/auth/admin/login",
                          json={"email": "admin@test.com", "password": "securepass1"})
        assert res.status_code == 200
        token = res.json()["access_token"]
        me = client.get("/v1/admin/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["role"] == "admin"

    def test_patient_token_cannot_reach_admin(self, client, auth_header):
        assert client.get("/v1/admin/me", headers=auth_header).status_code == 403
