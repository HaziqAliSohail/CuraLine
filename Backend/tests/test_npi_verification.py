"""Tests for automated NPI verification (CMS NPI Registry)."""
import pytest

import clients.npi as npi
from models.doctor import Doctor


def _registry_payload(first="Sarah", last="Jenkins", taxonomy="Cardiovascular Disease"):
    return {
        "result_count": 1,
        "results": [{
            "basic": {"first_name": first, "last_name": last},
            "taxonomies": [{"desc": taxonomy, "primary": True}],
        }],
    }


class TestVerifyNpiUnit:
    def test_verified_on_name_match(self, monkeypatch):
        monkeypatch.setattr(npi, "_fetch_registry", lambda n: _registry_payload())
        result = npi.verify_npi("1234567890", "Dr. Sarah Jenkins")
        assert result["status"] == npi.VERIFIED
        assert result["registry_name"] == "Sarah Jenkins"
        assert result["taxonomy"] == "Cardiovascular Disease"

    def test_mismatch_on_different_name(self, monkeypatch):
        monkeypatch.setattr(npi, "_fetch_registry", lambda n: _registry_payload("Robert", "Smith"))
        result = npi.verify_npi("1234567890", "Dr. Sarah Jenkins")
        assert result["status"] == npi.MISMATCH
        assert result["registry_name"] == "Robert Smith"

    def test_not_found(self, monkeypatch):
        monkeypatch.setattr(npi, "_fetch_registry", lambda n: {"result_count": 0, "results": []})
        assert npi.verify_npi("1234567890", "Dr. Sarah Jenkins")["status"] == npi.NOT_FOUND

    def test_error_on_registry_outage(self, monkeypatch):
        def _boom(n):
            raise ConnectionError("registry down")
        monkeypatch.setattr(npi, "_fetch_registry", _boom)
        assert npi.verify_npi("1234567890", "Dr. Sarah Jenkins")["status"] == npi.ERROR

    def test_titles_ignored_in_matching(self, monkeypatch):
        monkeypatch.setattr(npi, "_fetch_registry", lambda n: _registry_payload("Sarah", "Jenkins"))
        assert npi.verify_npi("1234567890", "Dr. Jenkins, MD")["status"] == npi.VERIFIED


APPLICATION = {
    "name": "Dr. Sarah Jenkins",
    "gender": "FEMALE",
    "email": "npi.test@newdoc.com",
    "password": "npitestpass1",
    "specialization": "Cardiology",
    "qualification": "MD",
    "license_number": "LIC-NPI-1",
    "npi_number": "1234567890",
}


class TestVerifyNpiEndpoint:
    def test_admin_verifies_applicant(self, client, admin_header, db, monkeypatch):
        # Affiliate the applicant with a hospital so the independent-NPI
        # auto-approval path is skipped and the manual verify path is exercised.
        from models.hospital import Hospital
        hospital = Hospital(name="Test General")
        db.add(hospital)
        db.flush()
        monkeypatch.setattr(npi, "_fetch_registry", lambda n: _registry_payload())
        client.post("/v1/auth/doctor/apply", json={**APPLICATION, "hospital_id": hospital.id})
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()
        assert doctor.npi_number == "1234567890"
        assert doctor.npi_verification_status == "UNVERIFIED"

        resp = client.post(f"/v1/doctors/{doctor.id}/verify-npi", headers=admin_header)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "VERIFIED"
        assert body["registry_name"] == "Sarah Jenkins"

        db.refresh(doctor)
        assert doctor.npi_verification_status == "VERIFIED"

        # The applications listing surfaces the stored result
        apps = client.get("/v1/doctors/applications", headers=admin_header).json()
        assert apps[0]["npi_verification_status"] == "VERIFIED"

    def test_independent_doctor_auto_approved_on_npi_match(self, client, db, monkeypatch):
        """An independent applicant (no hospital) with a matching NPI is
        fast-tracked to APPROVED without manual review."""
        monkeypatch.setattr(npi, "_fetch_registry", lambda n: _registry_payload())
        resp = client.post("/v1/auth/doctor/apply", json=APPLICATION)
        assert resp.json()["application_status"] == "APPROVED"
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()
        assert doctor.application_status == Doctor.APPROVED
        assert doctor.npi_verification_status == "VERIFIED"

    def test_independent_doctor_stays_pending_on_npi_mismatch(self, client, db, monkeypatch):
        """A non-matching NPI does not auto-approve - platform reviews manually."""
        monkeypatch.setattr(npi, "_fetch_registry", lambda n: _registry_payload("Robert", "Smith"))
        resp = client.post("/v1/auth/doctor/apply", json=APPLICATION)
        assert resp.json()["application_status"] == "PENDING"
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()
        assert doctor.npi_verification_status == "MISMATCH"

    def test_independent_doctor_without_npi_stays_pending(self, client, db):
        """No NPI supplied → no auto-approval, awaits platform review."""
        resp = client.post("/v1/auth/doctor/apply",
                           json={k: v for k, v in APPLICATION.items() if k != "npi_number"})
        assert resp.json()["application_status"] == "PENDING"

    def test_invalid_npi_format_rejected_at_apply(self, client):
        resp = client.post("/v1/auth/doctor/apply", json={**APPLICATION, "npi_number": "12345"})
        assert resp.status_code == 422

    def test_doctor_without_npi(self, client, admin_header, sample_doctor):
        resp = client.post(f"/v1/doctors/{sample_doctor.id}/verify-npi", headers=admin_header)
        assert resp.status_code == 422

    def test_non_admin_cannot_verify(self, client, auth_header, sample_doctor):
        resp = client.post(f"/v1/doctors/{sample_doctor.id}/verify-npi", headers=auth_header)
        assert resp.status_code == 403
