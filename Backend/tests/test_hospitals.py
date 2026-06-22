"""Tests for the hospital entity (multi-tenancy foundation)."""
import pytest

from models.hospital import Hospital


@pytest.fixture()
def sample_hospital(db):
    h = Hospital(name="Test General", address="1 Test Way", phone="+15550000")
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


class TestHospitals:
    def test_list_hospitals_public(self, client, sample_hospital):
        resp = client.get("/v1/hospitals/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test General"
        assert data[0]["doctor_count"] == 0

    def test_create_hospital_admin_only(self, client, auth_header, admin_header):
        body = {"name": "North Wing Clinic"}
        assert client.post("/v1/hospitals/", headers=auth_header, json=body).status_code == 403
        resp = client.post("/v1/hospitals/", headers=admin_header, json=body)
        assert resp.status_code == 201
        assert resp.json()["name"] == "North Wing Clinic"

    def test_assign_doctor_and_counts(self, client, admin_header, sample_hospital, sample_doctor, db):
        resp = client.put(
            f"/v1/hospitals/{sample_hospital.id}/assign/{sample_doctor.id}",
            headers=admin_header,
        )
        assert resp.status_code == 200
        assert resp.json()["doctor_count"] == 1

        db.refresh(sample_doctor)
        assert sample_doctor.hospital_id == sample_hospital.id

    def test_doctor_listing_includes_hospital_name(self, client, admin_header, sample_hospital, sample_doctor, db):
        sample_doctor.hospital_id = sample_hospital.id
        db.commit()
        docs = client.get("/v1/doctors/").json()
        me = next(d for d in docs if d["id"] == sample_doctor.id)
        assert me["hospital_name"] == "Test General"

    def test_doctor_listing_filters_by_hospital(self, client, sample_hospital, sample_doctor, db):
        sample_doctor.hospital_id = sample_hospital.id
        db.commit()
        in_hospital = client.get(f"/v1/doctors/?hospital_id={sample_hospital.id}").json()
        assert [d["id"] for d in in_hospital] == [sample_doctor.id]
        other = client.get("/v1/doctors/?hospital_id=9999").json()
        assert other == []

    def test_assign_unknown_doctor_404(self, client, admin_header, sample_hospital):
        resp = client.put(f"/v1/hospitals/{sample_hospital.id}/assign/9999", headers=admin_header)
        assert resp.status_code == 404
