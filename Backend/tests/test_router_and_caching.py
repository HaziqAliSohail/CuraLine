"""
Tests for the pre-filtering router and prompt caching token threshold.
"""
import pytest
from clients.router import match_local_routing
from clients.prompts import INTAKE_SYSTEM_PROMPT, SEVERITY_SYSTEM_PROMPT

def test_router_greetings():
    """Verify that initial greetings are routed locally when history is empty."""
    collected = {"chief_complaint": None, "symptoms": [], "symptom_duration": None, "pain_level": None}
    history = []
    
    res = match_local_routing("Hello", history, collected)
    assert res is not None
    assert "AI Assistant" in res["reply"]
    assert res["stage"] == "intake"
    assert res["is_booked"] is False

    res = match_local_routing("hey", history, collected)
    assert res is not None

def test_router_symptoms_not_routed():
    """Verify that symptoms are NOT routed locally so the LLM can handle them."""
    collected = {"chief_complaint": None, "symptoms": [], "symptom_duration": None, "pain_level": None}
    history = []
    
    res = match_local_routing("I have severe stomach pain", history, collected)
    assert res is None

def test_router_gratitude():
    """Verify that polite thank-you messages are routed locally."""
    collected = {"chief_complaint": "stomach pain", "symptoms": ["vomiting"], "symptom_duration": "2 days", "pain_level": 5}
    history = [{"role": "user", "content": "I have stomach pain"}, {"role": "assistant", "content": "Let me book that."}]
    
    res = match_local_routing("thank you so much", history, collected)
    assert res is not None
    assert "welcome" in res["reply"].lower()

def test_router_post_booking():
    """Verify post-booking closures (e.g. ok, thanks) are handled locally."""
    collected = {"chief_complaint": "stomach pain", "symptoms": ["vomiting"], "symptom_duration": "2 days", "pain_level": 5}
    # Simulate history where appointment was booked
    history = [
        {"role": "user", "content": "I have stomach pain"},
        {"role": "assistant", "content": "Your appointment has been successfully booked with Dr. Smith."}
    ]
    
    res = match_local_routing("ok thanks", history, collected)
    assert res is not None
    assert "look forward to seeing you" in res["reply"].lower()
    assert res["stage"] == "complete"

def test_prompt_token_lengths():
    """Ensure system prompts meet the minimum token count (2,048) to trigger caching."""
    # Using a conservative 1.3 tokens per word ratio
    intake_tokens = len(INTAKE_SYSTEM_PROMPT.split()) * 1.3
    severity_tokens = len(SEVERITY_SYSTEM_PROMPT.split()) * 1.3
    
    assert intake_tokens > 2048, f"Intake prompt token estimate ({intake_tokens}) below 2,048!"
    assert severity_tokens > 2048, f"Severity prompt token estimate ({severity_tokens}) below 2,048!"


def test_chat_execution_task_updates_medical_history(db, sample_patient, sample_doctor, sample_slot):
    """Verify that chat_execution_task appends assessment to patient's medical history upon booking."""
    from unittest.mock import patch
    from tasks.chat_tasks import chat_execution_task

    with patch("database.db.connection", return_value=db):
        with patch("clients.llmclient.LLMClient.query_structured") as mock_query:
            # 1. Intake LLM call -> returns ready_to_analyze=True
            # 2. Severity LLM call -> returns severity assessment
            mock_query.side_effect = [
                {
                    "stage": "intake",
                    "collected": {
                        "chief_complaint": "severe chest tightness",
                        "symptoms": ["shortness of breath"],
                        "symptom_duration": "3 hours",
                        "pain_level": 7
                    },
                    "missing": [],
                    "reply": "Checking slots.",
                    "ready_to_analyze": True
                },
                {
                    "severity_score": 3,
                    "recommended_specialization": "Cardiology",
                    "analysis_summary": "Cardiac evaluation recommended",
                    "is_emergency": False
                }
            ]

            history = [{"role": "user", "content": "I have chest tightness"}]
            collected = {}

            # Prevent task from closing the test session
            original_close = db.close
            db.close = lambda: None

            try:
                result = chat_execution_task(
                    patient_id=sample_patient.id,
                    conversation_history=history,
                    collected_fields=collected
                )
            finally:
                db.close = original_close

            assert result["is_booked"] is True
            
            # Verify patient's bio / medical history was updated
            db.refresh(sample_patient)
            assert sample_patient.medical_history is not None
            assert "Chief complaint: severe chest tightness" in sample_patient.medical_history
            assert "Severity: 3/5" in sample_patient.medical_history
            assert "Cardiac evaluation recommended" in sample_patient.medical_history


