"""Integration tests for doctors and slots endpoints."""
from datetime import date, time, timedelta


class TestDoctorsEndpoints:
    def test_list_doctors_empty(self, client):
        resp = client.get("/v1/doctors/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_doctor_as_admin(self, client, admin_header):
        resp = client.post("/v1/doctors/", json={
            "name": "Dr. New",
            "gender": "FEMALE",
            "specialization": "Neurology",
            "qualification": "MD",
            "consultation_fee": 300,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
        }, headers=admin_header)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Dr. New"
        assert data["specialization"] == "Neurology"

    def test_create_doctor_as_patient_forbidden(self, client, auth_header):
        """Regular patients cannot create doctors."""
        resp = client.post("/v1/doctors/", json={
            "name": "Dr. Unauthorized",
            "gender": "MALE",
            "specialization": "None",
            "qualification": "None",
            "consultation_fee": 0,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
        }, headers=auth_header)
        assert resp.status_code == 403

    def test_create_doctor_unauthenticated(self, client):
        resp = client.post("/v1/doctors/", json={
            "name": "Dr. Bad",
            "gender": "MALE",
            "specialization": "None",
            "qualification": "None",
            "consultation_fee": 0,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
        })
        assert resp.status_code == 401

    def test_get_doctor(self, client, sample_doctor):
        resp = client.get(f"/v1/doctors/{sample_doctor.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Dr. Smith"

    def test_get_doctor_not_found(self, client):
        resp = client.get("/v1/doctors/9999")
        assert resp.status_code == 404

    def test_update_doctor_as_admin(self, client, admin_header, sample_doctor):
        resp = client.put(f"/v1/doctors/{sample_doctor.id}", json={
            "name": "Dr. Smith Updated",
            "gender": "MALE",
            "specialization": "Cardiology",
            "qualification": "MD, DM",
            "consultation_fee": 350,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
        }, headers=admin_header)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Dr. Smith Updated"
        assert float(resp.json()["consultation_fee"]) == 350.0

    def test_delete_doctor_as_admin(self, client, admin_header, sample_doctor):
        resp = client.delete(f"/v1/doctors/{sample_doctor.id}", headers=admin_header)
        assert resp.status_code == 204
        resp2 = client.get(f"/v1/doctors/{sample_doctor.id}")
        assert resp2.status_code == 404

    def test_filter_by_specialization(self, client, sample_doctor):
        resp = client.get("/v1/doctors/?specialization=Cardio")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_filter_by_availability(self, client, sample_doctor):
        resp = client.get("/v1/doctors/?availability_status=AVAILABLE")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp2 = client.get("/v1/doctors/?availability_status=LEAVE")
        assert resp2.status_code == 200
        assert len(resp2.json()) == 0


class TestSlotsEndpoints:
    def test_list_slots_empty(self, client):
        resp = client.get("/v1/slots/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_slot_as_admin(self, client, admin_header, sample_doctor):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        resp = client.post("/v1/slots/", json={
            "doctor_id": sample_doctor.id,
            "date": tomorrow,
            "start_time": "10:00:00",
            "duration_minutes": 30,
            "closes_before_minutes": 15,
        }, headers=admin_header)
        assert resp.status_code == 201
        data = resp.json()
        assert data["doctor_id"] == sample_doctor.id
        assert data["is_available"] is True

    def test_create_slot_as_patient_forbidden(self, client, auth_header, sample_doctor):
        """Regular patients cannot create slots."""
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        resp = client.post("/v1/slots/", json={
            "doctor_id": sample_doctor.id,
            "date": tomorrow,
            "start_time": "11:00:00",
        }, headers=auth_header)
        assert resp.status_code == 403

    def test_create_slot_unauthenticated(self, client, sample_doctor):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        resp = client.post("/v1/slots/", json={
            "doctor_id": sample_doctor.id,
            "date": tomorrow,
            "start_time": "10:00:00",
        })
        assert resp.status_code == 401

    def test_create_slot_invalid_doctor(self, client, admin_header):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        resp = client.post("/v1/slots/", json={
            "doctor_id": 9999,
            "date": tomorrow,
            "start_time": "10:00:00",
        }, headers=admin_header)
        assert resp.status_code == 404

    def test_close_slot_as_admin(self, client, admin_header, sample_slot):
        resp = client.put(f"/v1/slots/{sample_slot.id}/close", headers=admin_header)
        assert resp.status_code == 200
        assert resp.json()["is_available"] is False

    def test_delete_slot_as_admin(self, client, admin_header, sample_slot):
        resp = client.delete(f"/v1/slots/{sample_slot.id}", headers=admin_header)
        assert resp.status_code == 204

    def test_filter_by_doctor(self, client, sample_slot, sample_doctor):
        resp = client.get(f"/v1/slots/?doctor_id={sample_doctor.id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_filter_available_only(self, client, sample_slot, db):
        sample_slot.is_available = False
        db.commit()
        resp = client.get("/v1/slots/?available_only=true")
        assert resp.status_code == 200
        assert len(resp.json()) == 0
