"""
Lightweight, static RAG knowledge base for urgent care guidance.

Maps symptom keywords to actionable recommendations across four categories:
  - EMERGENCY  → Call 911 / Go to ER
  - URGENT_CARE → Visit urgent care clinic
  - TELEHEALTH  → Schedule a virtual consultation
  - FIRST_AID   → Self-care / home remedies

⚠️  This system does not diagnose conditions. It avoids medication
recommendations EXCEPT for a few time-critical, life-saving emergency measures
(aspirin for a suspected heart attack, an EpiPen for anaphylaxis, a rescue
inhaler for breathing difficulty) - always framed conditionally. All guidance is
general and carries a "not medical advice" disclaimer.
"""

from __future__ import annotations

import math
import os

from loguru import logger

from settings import settings

URGENT_CARE_KB: list[dict] = [
    # ── EMERGENCY (severity floor 5) ──────────────────────────────────
    {
        "keywords": ["chest pain", "chest pressure", "chest tightness", "heart attack",
                     "arm pain radiating", "crushing chest"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 911 immediately. Do not drive yourself. "
            "If you are not allergic and it is readily available, an aspirin may "
            "help while you wait for paramedics. Stay calm and sit upright."
        ),
    },
    {
        "keywords": ["difficulty breathing", "shortness of breath", "cant breathe",
                     "can't breathe", "gasping", "choking"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 911. Sit upright and try to stay calm. "
            "Loosen any tight clothing. Use your inhaler if you have one."
        ),
    },
    {
        "keywords": ["stroke", "face drooping", "slurred speech", "sudden numbness",
                     "sudden confusion", "sudden vision loss"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 911 immediately. Note the time symptoms started. "
            "Do not eat, drink, or take medication. Keep the person comfortable and still."
        ),
    },
    {
        "keywords": ["severe bleeding", "uncontrollable bleeding", "deep wound",
                     "heavy bleeding", "arterial bleeding"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 911. Apply firm, direct pressure with a clean cloth. "
            "Do not remove the cloth; add more layers if needed. Elevate the injured area above the heart."
        ),
    },
    {
        "keywords": ["seizure", "convulsions", "epileptic", "fitting"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 911 if the seizure lasts more than 5 minutes or it's the first seizure. "
            "Clear the area of sharp objects. Do NOT restrain the person or put anything in their mouth. "
            "Place them on their side after the seizure stops."
        ),
    },
    {
        "keywords": ["anaphylaxis", "severe allergic reaction", "throat swelling",
                     "tongue swelling", "epipen"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 911 immediately. Use an epinephrine auto-injector (EpiPen) if available. "
            "Have the person lie down and elevate their legs. Do not give oral medications."
        ),
    },
    {
        "keywords": ["overdose", "poisoning", "took too many pills", "drug overdose"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 911 or Poison Control (1-800-222-1222). "
            "Do not induce vomiting unless instructed. Keep the person conscious and on their side."
        ),
    },
    {
        "keywords": ["suicidal", "suicide", "want to die", "self harm", "self-harm",
                     "kill myself", "ending my life"],
        "severity_floor": 5,
        "action": "EMERGENCY",
        "guidance": (
            "Call 988 (Suicide & Crisis Lifeline) or 911 immediately. "
            "You are not alone. Stay on the line and remove access to harmful objects. "
            "Someone is ready to help you right now."
        ),
    },

    # ── URGENT_CARE (severity floor 3-4) ─────────────────────────────
    {
        "keywords": ["broken bone", "fracture", "bone sticking out", "deformity",
                     "can't move arm", "can't move leg", "twisted ankle"],
        "severity_floor": 4,
        "action": "URGENT_CARE",
        "guidance": (
            "Visit the nearest urgent care or ER. Immobilize the injured area. "
            "Apply ice wrapped in a cloth. Do not attempt to straighten the limb."
        ),
    },
    {
        "keywords": ["deep cut", "laceration", "stitches needed", "wound won't stop bleeding"],
        "severity_floor": 3,
        "action": "URGENT_CARE",
        "guidance": (
            "Visit urgent care for evaluation. Apply firm pressure with a clean cloth. "
            "If the cut is deeper than ¼ inch or won't stop bleeding after 15 minutes, seek immediate care."
        ),
    },
    {
        "keywords": ["high fever", "fever 103", "fever 104", "fever won't break",
                     "fever and stiff neck", "fever child"],
        "severity_floor": 4,
        "action": "URGENT_CARE",
        "guidance": (
            "Visit urgent care if fever exceeds 103°F (39.4°C) or lasts more than 3 days. "
            "Stay hydrated and rest. "
            "Seek ER immediately if accompanied by stiff neck, confusion, or rash."
        ),
    },
    {
        "keywords": ["severe abdominal pain", "stomach pain severe", "appendicitis",
                     "sharp stomach pain", "lower right pain"],
        "severity_floor": 4,
        "action": "URGENT_CARE",
        "guidance": (
            "Visit urgent care or ER for evaluation. Do not eat or drink until evaluated. "
            "Avoid taking pain medication before diagnosis as it may mask symptoms."
        ),
    },
    {
        "keywords": ["burn", "burned", "scalded", "chemical burn", "sunburn severe"],
        "severity_floor": 3,
        "action": "URGENT_CARE",
        "guidance": (
            "For burns larger than your palm or on the face/hands/joints, visit urgent care. "
            "Cool the burn under lukewarm (not cold) running water for 10-20 minutes. "
            "Do not apply ice, butter, or toothpaste. Cover loosely with a sterile bandage."
        ),
    },
    {
        "keywords": ["concussion", "head injury", "hit my head", "dizziness after fall",
                     "seeing stars"],
        "severity_floor": 4,
        "action": "URGENT_CARE",
        "guidance": (
            "Visit urgent care or ER for evaluation. Rest in a quiet, dark room. "
            "Do not take aspirin or ibuprofen (may increase bleeding risk). "
            "Seek ER immediately if there is vomiting, worsening headache, or loss of consciousness."
        ),
    },
    {
        "keywords": ["eye injury", "something in my eye", "eye pain", "vision changes",
                     "chemical in eye"],
        "severity_floor": 3,
        "action": "URGENT_CARE",
        "guidance": (
            "For chemical exposure, flush the eye with clean water for 15-20 minutes immediately. "
            "Do not rub the eye. Visit urgent care or an eye specialist promptly."
        ),
    },
    {
        "keywords": ["animal bite", "dog bite", "cat bite", "snake bite", "insect bite swelling"],
        "severity_floor": 3,
        "action": "URGENT_CARE",
        "guidance": (
            "Clean the wound with soap and water. Visit urgent care for evaluation - "
            "you may need a tetanus shot or antibiotics. For snake bites, call 911."
        ),
    },

    # ── TELEHEALTH (severity floor 2) ────────────────────────────────
    {
        "keywords": ["fever", "temperature", "chills", "mild fever", "low grade fever"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth consultation. Stay hydrated and rest. "
            "Seek ER if fever exceeds 104°F."
        ),
    },
    {
        "keywords": ["sore throat", "throat pain", "painful swallowing", "strep",
                     "tonsils swollen"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit for evaluation. Gargle with warm salt water. "
            "Stay hydrated with warm fluids and rest your voice."
        ),
    },
    {
        "keywords": ["cough", "persistent cough", "coughing", "cough won't go away",
                     "dry cough"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit if cough persists beyond 2 weeks. "
            "Stay hydrated. Use honey (adults only) to soothe the throat. "
            "Use a humidifier at night."
        ),
    },
    {
        "keywords": ["rash", "skin rash", "hives", "itchy skin", "eczema flare",
                     "red spots"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit for diagnosis. Avoid scratching. "
            "Apply cool compresses and a fragrance-free moisturizer."
        ),
    },
    {
        "keywords": ["urinary tract infection", "uti", "burning urination", "frequent urination",
                     "painful urination", "blood in urine"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit for evaluation and possible prescription. "
            "Drink plenty of water. Avoid caffeine and alcohol. "
            "Seek ER if you develop fever, back pain, or blood in urine."
        ),
    },
    {
        "keywords": ["ear pain", "earache", "ear infection", "clogged ear",
                     "ringing in ear"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit. Apply a warm compress to the affected ear. "
            "Do not insert anything into the ear."
        ),
    },
    {
        "keywords": ["pink eye", "conjunctivitis", "eye redness", "eye discharge",
                     "crusty eye"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit. Avoid touching or rubbing the eye. "
            "Use a clean, warm compress. Wash hands frequently to prevent spreading."
        ),
    },
    {
        "keywords": ["back pain", "lower back pain", "back hurts", "back spasm",
                     "sciatica"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit if pain persists beyond a few days. "
            "Apply ice for the first 48 hours, then switch to heat. "
            "Gentle stretching and movement can help. Avoid heavy lifting."
        ),
    },
    {
        "keywords": ["anxiety", "panic attack", "anxious", "racing heart stress",
                     "can't sleep anxiety"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit for evaluation. Practice deep breathing: "
            "inhale for 4 seconds, hold for 4, exhale for 6. "
            "Limit caffeine and screen time before bed. You are not alone."
        ),
    },
    {
        "keywords": ["migraine", "severe headache", "headache with aura", "throbbing headache",
                     "headache and nausea"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit if migraines are frequent. "
            "Rest in a quiet, dark room. Apply a cold compress to your forehead. "
            "Stay hydrated. Seek ER if headache is sudden and 'worst ever.'"
        ),
    },
    {
        "keywords": ["diarrhea", "vomiting", "nausea", "stomach bug", "food poisoning",
                     "stomach flu"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit if symptoms last more than 2 days. "
            "Sip small amounts of water or electrolyte drinks frequently. "
            "Follow the BRAT diet (bananas, rice, applesauce, toast). "
            "Seek ER if you cannot keep fluids down for 24+ hours."
        ),
    },
    {
        "keywords": ["insomnia", "can't sleep", "sleep problems", "waking up at night"],
        "severity_floor": 2,
        "action": "TELEHEALTH",
        "guidance": (
            "Schedule a telehealth visit for evaluation. "
            "Maintain a consistent sleep schedule. Avoid screens 1 hour before bed. "
            "Limit caffeine after noon. Keep your room cool and dark."
        ),
    },

    # ── FIRST_AID (severity floor 1) ─────────────────────────────────
    {
        "keywords": ["minor cut", "small cut", "paper cut", "scrape", "scratch",
                     "abrasion"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Clean the wound with soap and water. Cover it with a clean bandage "
            "and change it daily. "
            "Watch for signs of infection (redness, swelling, warmth)."
        ),
    },
    {
        "keywords": ["bruise", "bruised", "contusion", "bumped"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Apply ice wrapped in a cloth for 10-20 minutes several times a day. "
            "Elevate the area if possible. Most bruises heal within 2 weeks. "
            "See a doctor if the bruise is unusually large or painful."
        ),
    },
    {
        "keywords": ["mild headache", "tension headache", "head hurts", "headache"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Rest in a quiet environment. Stay hydrated. "
            "Apply a cold or warm compress to your forehead or neck."
        ),
    },
    {
        "keywords": ["muscle soreness", "sore muscles", "pulled muscle", "muscle strain",
                     "overexertion"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Rest the affected muscle. Apply ice for the first 48 hours, then heat. "
            "Gentle stretching can help. "
            "See a doctor if pain is severe or doesn't improve within a week."
        ),
    },
    {
        "keywords": ["stuffy nose", "runny nose", "congestion", "common cold",
                     "sneezing", "cold symptoms"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Rest and stay hydrated. Use saline nasal spray for congestion. "
            "Warm liquids like tea or soup can provide relief. "
            "Most colds resolve within 7-10 days."
        ),
    },
    {
        "keywords": ["splinter", "sliver", "foreign body skin"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Clean the area with soap and water. Use sterilized tweezers to gently "
            "remove the splinter. Keep the area clean and cover it with a bandage. "
            "See a doctor if you cannot remove it or signs of infection develop."
        ),
    },
    {
        "keywords": ["mild sunburn", "sunburn", "sun exposure"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Apply aloe vera gel or moisturizing lotion. Take cool (not cold) baths. "
            "Stay hydrated and avoid further sun exposure. "
            "See a doctor if blistering is extensive."
        ),
    },
    {
        "keywords": ["nosebleed", "nose bleed", "bleeding nose"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Sit upright and lean slightly forward. Pinch the soft part of your nose "
            "for 10-15 minutes. Do not tilt your head back. Apply ice to the bridge "
            "of your nose. Seek care if bleeding lasts more than 20 minutes."
        ),
    },
    {
        "keywords": ["blister", "friction blister", "foot blister"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Do not pop the blister. Cover it with a bandage or blister pad. "
            "If it pops on its own, clean with soap and water "
            "and cover with a sterile bandage."
        ),
    },
    {
        "keywords": ["bee sting", "wasp sting", "insect sting", "bug bite"],
        "severity_floor": 1,
        "action": "FIRST_AID",
        "guidance": (
            "Remove the stinger by scraping with a flat edge (not tweezers). "
            "Clean with soap and water. Apply ice to reduce swelling. "
            "Seek ER immediately if you experience difficulty breathing or swelling of face/throat."
        ),
    },
]

# Disclaimer appended to all guidance
GUIDANCE_DISCLAIMER = (
    "⚠️ This is general guidance, not medical advice. "
    "Always consult a healthcare professional for proper diagnosis and treatment."
)


SEMANTIC_THRESHOLD = 0.45
_EMBED_MODEL = "text-embedding-3-small"
_KB_VECTORS = None  # cached [(entry, vector)] once embedded


def _entry_out(entry: dict) -> dict:
    return {
        "action": entry["action"],
        "guidance": entry["guidance"],
        "severity_floor": entry["severity_floor"],
    }


def match_urgent_guidance(symptoms_text: str) -> dict | None:
    """Match patient symptoms against the urgent care knowledge base.

    Keyword matching runs first (deterministic, fast, and the basis of the
    100%-emergency-recall CI gate). Only when keywords find nothing do we fall
    back to optional semantic matching (embeddings) to catch phrasings the
    keywords miss. Semantic matching is off unless SEMANTIC_GUIDANCE is enabled
    with an OpenAI key — so behavior is unchanged without it.
    """
    if not symptoms_text:
        return None
    return _keyword_match(symptoms_text) or _semantic_match(symptoms_text)


def _keyword_match(symptoms_text: str) -> dict | None:
    text_lower = symptoms_text.lower()
    best_match = None
    best_score = 0
    for entry in URGENT_CARE_KB:
        score = sum(1 for kw in entry["keywords"] if kw in text_lower)
        if score > best_score:
            best_score = score
            best_match = entry
    if best_match is None or best_score == 0:
        return None
    return _entry_out(best_match)


def _cosine(a, b) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def _embed(texts: list[str]) -> list[list[float]]:
    from openai import OpenAI
    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.embeddings.create(model=_EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def _kb_embeddings():
    global _KB_VECTORS
    if _KB_VECTORS is None:
        texts = [", ".join(e["keywords"]) for e in URGENT_CARE_KB]
        _KB_VECTORS = list(zip(URGENT_CARE_KB, _embed(texts)))
    return _KB_VECTORS


def _semantic_match(symptoms_text: str) -> dict | None:
    """Embedding-similarity fallback. No-ops (returns None) in tests, when the
    feature is off, or on any embedding failure — never raises."""
    if os.environ.get("TESTING") == "True":
        return None
    if not settings.semantic_guidance or not settings.openai_api_key.strip():
        return None
    try:
        query_vec = _embed([symptoms_text])[0]
        best, best_sim = None, 0.0
        for entry, vec in _kb_embeddings():
            sim = _cosine(query_vec, vec)
            if sim > best_sim:
                best_sim, best = sim, entry
        if best and best_sim >= SEMANTIC_THRESHOLD:
            logger.info(f"[GUIDANCE] semantic match (sim={best_sim:.2f}) -> {best['action']}")
            return _entry_out(best)
    except Exception as exc:
        logger.debug(f"semantic guidance unavailable, using keyword only: {exc}")
    return None
