"""Golden triage vignettes — the labeled set the eval harness scores against.

Each case is a realistic patient description with the clinically expected
outcome. This is a *starter* set meant to be reviewed and expanded by a
clinician; treat the labels as the source of truth for regression testing.

Fields:
  id             stable identifier
  text           patient's description (used for KB match + as chief complaint)
  emergency      True if this should escalate to 911/ER
  severity       expected 1-5 severity (target; live eval allows ±tolerance)
  specialization clinically ideal specialty (live eval matches loosely)
"""

VIGNETTES = [
    # ── Emergencies (must escalate) ──────────────────────────────────
    {"id": "mi", "text": "severe crushing chest pain radiating to my left arm for the past hour",
     "emergency": True, "severity": 5, "specialization": "Cardiology"},
    {"id": "stroke", "text": "sudden face drooping, slurred speech, and weakness on one side",
     "emergency": True, "severity": 5, "specialization": "Neurology"},
    {"id": "anaphylaxis", "text": "throat swelling and difficulty breathing after a bee sting",
     "emergency": True, "severity": 5, "specialization": "General Medicine"},
    {"id": "resp_distress", "text": "sudden severe shortness of breath, I can't breathe",
     "emergency": True, "severity": 5, "specialization": "Pulmonology"},
    {"id": "hemorrhage", "text": "heavy uncontrollable bleeding from a deep wound",
     "emergency": True, "severity": 5, "specialization": "General Medicine"},
    {"id": "suicidal", "text": "I feel suicidal and want to die",
     "emergency": True, "severity": 5, "specialization": "General Medicine"},
    {"id": "overdose", "text": "I think I took too many pills, possible overdose",
     "emergency": True, "severity": 5, "specialization": "General Medicine"},
    {"id": "seizure", "text": "my friend is having a seizure with convulsions right now",
     "emergency": True, "severity": 5, "specialization": "Neurology"},

    # ── Urgent (same-day, not 911) ───────────────────────────────────
    {"id": "fracture", "text": "I fell and my arm looks deformed, I think it's a fracture",
     "emergency": False, "severity": 4, "specialization": "Orthopedics"},
    {"id": "high_fever", "text": "high fever of 103 that won't break for two days",
     "emergency": False, "severity": 4, "specialization": "General Medicine"},
    {"id": "appendicitis", "text": "severe sharp lower right abdominal pain since this morning",
     "emergency": False, "severity": 4, "specialization": "General Medicine"},
    {"id": "concussion", "text": "hit my head hard, now dizziness and seeing stars",
     "emergency": False, "severity": 4, "specialization": "Neurology"},

    # ── Moderate ─────────────────────────────────────────────────────
    {"id": "uti", "text": "burning urination and frequent urination for two days",
     "emergency": False, "severity": 3, "specialization": "General Medicine"},
    {"id": "migraine", "text": "throbbing headache with nausea and an aura",
     "emergency": False, "severity": 3, "specialization": "Neurology"},
    {"id": "back_pain", "text": "moderate lower back pain and spasm after lifting boxes",
     "emergency": False, "severity": 3, "specialization": "Orthopedics"},

    # ── Routine / low ────────────────────────────────────────────────
    {"id": "cold", "text": "runny nose, sneezing, and mild congestion for two days",
     "emergency": False, "severity": 1, "specialization": "General Medicine"},
    {"id": "tension_headache", "text": "mild tension headache, my head hurts a little",
     "emergency": False, "severity": 1, "specialization": "General Medicine"},
    {"id": "sore_throat", "text": "mild sore throat and slightly painful swallowing",
     "emergency": False, "severity": 2, "specialization": "General Medicine"},
    {"id": "paper_cut", "text": "small paper cut on my finger",
     "emergency": False, "severity": 1, "specialization": "General Medicine"},
    {"id": "rash", "text": "mild itchy skin rash on my arm",
     "emergency": False, "severity": 2, "specialization": "Dermatology"},
    {"id": "bruise", "text": "minor bruise on my leg after bumping into a table",
     "emergency": False, "severity": 1, "specialization": "General Medicine"},
]
