"""CI safety gate for triage.

Deterministic (no LLM): the urgent-care KB must catch every labeled emergency
(100% recall) and must NOT fire emergency on non-emergencies. This guards the
deterministic safety net layered under the LLM in chat_tasks.
"""
from eval.evaluator import kb_emergency_eval
from eval.vignettes import VIGNETTES


def test_dataset_is_balanced():
    em = sum(1 for v in VIGNETTES if v["emergency"])
    non = len(VIGNETTES) - em
    assert em >= 5 and non >= 8, "eval set needs a meaningful spread"


def test_emergency_recall_is_perfect():
    """A missed emergency is a patient-harm event — recall must be 100%."""
    r = kb_emergency_eval(VIGNETTES)
    assert r["emergency_recall"] == 1.0, f"KB missed emergencies: {r['emergency_missed']}"


def test_no_false_emergencies():
    """Non-emergencies must not be escalated to severity-floor 5 by the KB."""
    r = kb_emergency_eval(VIGNETTES)
    assert r["false_emergencies"] == [], f"false emergencies: {r['false_emergencies']}"
