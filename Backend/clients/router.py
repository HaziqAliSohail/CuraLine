"""
Local routing module to intercept simple patient messages and bypass LLM calls.
"""
import re

GREETING_PATTERNS = [
    r"^\s*hello\s*$",
    r"^\s*hi\s*$",
    r"^\s*hey\s*$",
    r"^\s*good morning\s*$",
    r"^\s*good afternoon\s*$",
    r"^\s*good evening\s*$",
    r"^\s*is anyone there\??\s*$",
    r"^\s*howdy\s*$",
    r"^\s*sup\s*$",
    r"^\s*hello AI\s*$"
]

GRATITUDE_PATTERNS = [
    r"\bthank(s|\s+you)\b",
    r"\bappreciate\s+it\b",
    r"\bthank\s*you\s*so\s*much\b"
]

CONFIRMATION_PATTERNS = [
    r"^\s*ok\s*$",
    r"^\s*okay\s*$",
    r"^\s*sounds\s*good\s*$",
    r"^\s*perfect\s*$",
    r"^\s*sure\s*$",
    r"^\s*yes\s*$",
    r"^\s*no\s*$"
]

def match_local_routing(message: str, conversation_history: list, collected_fields: dict) -> dict | None:
    """
    Inspects user message and state to determine if we can respond locally, bypassing LLM.
    
    Returns:
        dict: Simulates the chat task output format if matched, otherwise None.
    """
    if not message:
        return None

    clean_msg = message.strip().strip(".?!,;").lower()

    # 1. Post-Booking Gratitude / Closure
    # If we already have a successful booking (e.g. stage is complete or fields are populated),
    # any polite closing should be answered statically.
    has_booked = collected_fields.get("chief_complaint") and len(conversation_history) > 3
    
    # Check if last message from Assistant was a booking confirmation
    last_assistant_msg = ""
    for msg in reversed(conversation_history):
        if msg.get("role") == "assistant":
            last_assistant_msg = msg.get("content", "")
            break
            
    is_post_booking = "booked" in last_assistant_msg.lower() or "appointment" in last_assistant_msg.lower()

    if is_post_booking:
        is_closing = (
            any(re.search(pat, clean_msg) for pat in GRATITUDE_PATTERNS) or
            any(re.match(pat, clean_msg) for pat in CONFIRMATION_PATTERNS) or
            clean_msg in ["bye", "goodbye", "exit"]
        )
        if is_closing:
            return {
                "is_booked": False,
                "reply": "You're very welcome! We look forward to seeing you at your scheduled appointment. Have a wonderful day!",
                "severity_score": 0,
                "collected": collected_fields,
                "stage": "complete"
            }

    # 2. Initial Greetings (only if conversation hasn't really started yet)
    if not collected_fields.get("chief_complaint"):
        is_greeting = any(re.match(pat, clean_msg) for pat in GREETING_PATTERNS)
        if is_greeting:
            return {
                "is_booked": False,
                "reply": "Hello! I am CuraLine's AI Assistant. Please describe the symptoms you are experiencing, how long you've had them, and your current discomfort level so I can help book the right appointment for you.",
                "severity_score": 0,
                "collected": collected_fields,
                "stage": "intake"
            }

    # 3. Mid-conversation Gratitude
    is_gratitude = any(re.match(pat, clean_msg) for pat in GRATITUDE_PATTERNS)
    if is_gratitude:
        return {
            "is_booked": False,
            "reply": "You're welcome! Please describe your symptoms and discomfort level to proceed with booking your appointment.",
            "severity_score": 0,
            "collected": collected_fields,
            "stage": "intake"
        }

    return None
