"""Tests for the async chat contract: POST dispatches a job (or runs inline
when the broker is down), GET polls for the result."""
from unittest.mock import MagicMock, patch


class TestStartInference:
    def test_empty_message_rejected(self, client, auth_header):
        resp = client.post("/v1/inference/", headers=auth_header,
                           json={"message": "   ", "conversation_history": [], "collected_fields": {}})
        assert resp.status_code == 422

    def test_dispatch_returns_pending_job(self, client, auth_header):
        fake_async = MagicMock()
        fake_async.id = "job-uuid-123"
        with patch("web.inference.inference.chat_execution_task") as task:
            task.delay.return_value = fake_async
            resp = client.post("/v1/inference/", headers=auth_header,
                               json={"message": "I have a headache", "conversation_history": [], "collected_fields": {}})
        assert resp.status_code == 202
        body = resp.json()
        assert body["status"] == "pending"
        assert body["job_id"] == "job-uuid-123"
        assert body["result"] is None
        task.delay.assert_called_once()

    def test_inline_fallback_when_broker_down(self, client, auth_header):
        with patch("web.inference.inference.chat_execution_task") as task:
            task.delay.side_effect = ConnectionError("broker unreachable")
            task.return_value = {
                "reply": "Tell me more about your symptoms.",
                "is_booked": False,
                "severity_score": 0,
                "stage": "intake",
                "collected": {"chief_complaint": "headache"},
            }
            resp = client.post("/v1/inference/", headers=auth_header,
                               json={"message": "I have a headache", "conversation_history": [], "collected_fields": {}})
        assert resp.status_code == 202
        body = resp.json()
        assert body["status"] == "complete"
        assert body["job_id"] is None
        assert body["result"]["message"] == "Tell me more about your symptoms."
        assert body["result"]["stage"] == "intake"

    def test_requires_auth(self, client):
        resp = client.post("/v1/inference/", json={"message": "hi"})
        assert resp.status_code == 401


class TestPollInference:
    def test_poll_pending(self, client, auth_header):
        fake = MagicMock()
        fake.ready.return_value = False
        with patch("celery.result.AsyncResult", return_value=fake):
            resp = client.get("/v1/inference/result/some-job", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"
        assert resp.json()["result"] is None

    def test_poll_complete(self, client, auth_header, sample_patient):
        fake = MagicMock()
        fake.ready.return_value = True
        fake.failed.return_value = False
        fake.kwargs = {"patient_id": sample_patient.id}
        fake.result = {
            "reply": "Your appointment is booked!",
            "is_booked": True,
            "appointment_id": 42,
            "severity_score": 3,
            "stage": "complete",
        }
        with patch("celery.result.AsyncResult", return_value=fake):
            resp = client.get("/v1/inference/result/some-job", headers=auth_header)
        body = resp.json()
        assert body["status"] == "complete"
        assert body["result"]["is_appointment_booked"] is True
        assert body["result"]["appointment_id"] == 42

    def test_poll_other_users_job_denied(self, client, auth_header, sample_patient):
        """A token holder must not read another patient's chat result."""
        fake = MagicMock()
        fake.ready.return_value = True
        fake.failed.return_value = False
        fake.kwargs = {"patient_id": sample_patient.id + 99999}
        fake.result = {"reply": "someone else's private reply", "is_booked": True}
        with patch("celery.result.AsyncResult", return_value=fake):
            resp = client.get("/v1/inference/result/some-job", headers=auth_header)
        assert resp.status_code == 404

    def test_poll_failed_returns_graceful_message(self, client, auth_header):
        fake = MagicMock()
        fake.ready.return_value = True
        fake.failed.return_value = True
        fake.kwargs = {}
        fake.result = Exception("worker exploded")
        with patch("celery.result.AsyncResult", return_value=fake):
            resp = client.get("/v1/inference/result/some-job", headers=auth_header)
        body = resp.json()
        assert body["status"] == "complete"
        assert "trouble" in body["result"]["message"].lower()

    def test_poll_requires_auth(self, client):
        resp = client.get("/v1/inference/result/some-job")
        assert resp.status_code == 401
