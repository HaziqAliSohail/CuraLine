"""Product analytics instrumentation."""
from clients import analytics
from clients.analytics import EVENTS


def test_track_captures_in_test_mode():
    EVENTS.clear()
    analytics.track("unit_event", 42, severity=3, foo="bar")
    assert EVENTS[-1] == {
        "event": "unit_event", "distinct_id": "42",
        "properties": {"severity": 3, "foo": "bar"},
    }


def test_booking_emits_funnel_events(db, sample_patient, sample_doctor, sample_slot):
    """A completed booking emits triage_assessed + booking_created (no PHI)."""
    from unittest.mock import patch
    from tasks.chat_tasks import chat_execution_task

    EVENTS.clear()
    with patch("database.db.connection", return_value=db):
        with patch("clients.llmclient.LLMClient.query_structured") as mock_query:
            mock_query.side_effect = [
                {"stage": "intake", "collected": {
                    "chief_complaint": "occasional mild heart palpitations",
                    "symptoms": ["palpitations"], "symptom_duration": "1 week", "pain_level": 3},
                 "missing": [], "reply": "ok", "ready_to_analyze": True},
                {"severity_score": 3, "recommended_specialization": "Cardiology",
                 "analysis_summary": "Cardiac review.", "is_emergency": False},
            ]
            original_close = db.close
            db.close = lambda: None
            try:
                chat_execution_task(
                    patient_id=sample_patient.id,
                    conversation_history=[{"role": "user", "content": "palpitations"}],
                    collected_fields={},
                )
            finally:
                db.close = original_close

    names = [e["event"] for e in EVENTS]
    assert "triage_assessed" in names
    assert "booking_created" in names
    # No PHI leaked into properties.
    for e in EVENTS:
        blob = str(e["properties"]).lower()
        assert "palpitation" not in blob
