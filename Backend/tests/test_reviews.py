"""Tests for verified-patient reviews: gated on doctor-recorded COMPLETED
outcomes, one per visit, privacy-abbreviated names, live rating aggregation."""
import pytest

from models.appointment import Appointment
from models.patient import Patient
from models.review import Review
from web.auth.security import create_access_token, hash_password


@pytest.fixture()
def completed_appointment(db, sample_appointment):
    sample_appointment.status = Appointment.COMPLETED
    db.commit()
    return sample_appointment


class TestReviewGating:
    def test_review_completed_visit(self, client, auth_header, completed_appointment, db):
        resp = client.post("/v1/reviews/", headers=auth_header, json={
            "appointment_id": completed_appointment.id,
            "rating": 4,
            "comment": "Very attentive doctor.",
        })
        assert resp.status_code == 201
        assert resp.json()["rating"] == 4

    def test_cannot_review_scheduled_visit(self, client, auth_header, sample_appointment):
        resp = client.post("/v1/reviews/", headers=auth_header, json={
            "appointment_id": sample_appointment.id,
            "rating": 5,
        })
        assert resp.status_code == 409
        assert "completed" in resp.json()["detail"].lower()

    def test_cannot_review_cancelled_visit(self, client, auth_header, sample_appointment, db):
        sample_appointment.status = Appointment.CANCELLED
        db.commit()
        resp = client.post("/v1/reviews/", headers=auth_header, json={
            "appointment_id": sample_appointment.id,
            "rating": 5,
        })
        assert resp.status_code == 409

    def test_cannot_review_other_patients_visit(self, client, completed_appointment, db):
        other = Patient(
            name="Other Reviewer",
            gender="FEMALE",
            email="otherreviewer@test.com",
            password_hash=hash_password("securepass1"),
        )
        db.add(other)
        db.commit()
        token = create_access_token(other.id)
        resp = client.post(
            "/v1/reviews/",
            headers={"Authorization": f"Bearer {token}"},
            json={"appointment_id": completed_appointment.id, "rating": 1},
        )
        assert resp.status_code == 404

    def test_one_review_per_visit(self, client, auth_header, completed_appointment):
        body = {"appointment_id": completed_appointment.id, "rating": 5}
        assert client.post("/v1/reviews/", headers=auth_header, json=body).status_code == 201
        assert client.post("/v1/reviews/", headers=auth_header, json=body).status_code == 409

    def test_rating_bounds_enforced(self, client, auth_header, completed_appointment):
        for bad in (0, 6):
            resp = client.post("/v1/reviews/", headers=auth_header, json={
                "appointment_id": completed_appointment.id,
                "rating": bad,
            })
            assert resp.status_code == 422


class TestPublicReviews:
    def test_doctor_reviews_listing(self, client, auth_header, completed_appointment, sample_patient, sample_doctor):
        client.post("/v1/reviews/", headers=auth_header, json={
            "appointment_id": completed_appointment.id,
            "rating": 4,
            "comment": "Great visit.",
        })

        resp = client.get(f"/v1/reviews/doctor/{sample_doctor.id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["review_count"] == 1
        assert body["average_rating"] == 4.0
        review = body["reviews"][0]
        assert review["verified"] is True
        assert review["comment"] == "Great visit."
        # Privacy: full name never exposed - "Test Patient" → "Test P."
        assert review["patient_display_name"] == "Test P."
        assert sample_patient.name not in str(body)

    def test_unknown_doctor_404(self, client):
        assert client.get("/v1/reviews/doctor/9999").status_code == 404

    def test_doctor_rating_recomputed(self, client, auth_header, completed_appointment, sample_doctor, db):
        client.post("/v1/reviews/", headers=auth_header, json={
            "appointment_id": completed_appointment.id,
            "rating": 2,
        })
        db.refresh(sample_doctor)
        assert sample_doctor.rating == 2  # was seeded 5; single review of 2 → avg 2

    def test_my_reviews(self, client, auth_header, completed_appointment):
        client.post("/v1/reviews/", headers=auth_header, json={
            "appointment_id": completed_appointment.id,
            "rating": 3,
        })
        resp = client.get("/v1/reviews/mine", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["appointment_id"] == completed_appointment.id
