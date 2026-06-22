"""Triage prompts instruct the model to reply in the patient's language."""
from clients.prompts import INTAKE_SYSTEM_PROMPT, SEVERITY_SYSTEM_PROMPT


def test_intake_prompt_is_bilingual():
    assert "same language" in INTAKE_SYSTEM_PROMPT.lower()


def test_severity_prompt_is_bilingual():
    assert "same language" in SEVERITY_SYSTEM_PROMPT.lower()
