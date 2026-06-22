"""SMS via Twilio.

Feature-flagged on the Twilio settings: with no credentials, send_sms logs and
returns False (so dev + tests work with zero setup). Never raises — an SMS
failure must never break the flow that triggered it. In TESTING, messages are
captured in OUTBOX for assertions. Uses Twilio's REST API over httpx (no extra
dependency).
"""
import os

import httpx
from loguru import logger

from settings import settings

OUTBOX: list[dict] = []  # test capture


def is_configured() -> bool:
    return bool(
        settings.twilio_account_sid.strip()
        and settings.twilio_auth_token.strip()
        and settings.twilio_from_number.strip()
    )


def send_sms(to: str, body: str) -> bool:
    """Send an SMS. Returns True if sent (or captured). Never raises."""
    if not to:
        return False
    if os.environ.get("TESTING") == "True":
        OUTBOX.append({"to": to, "body": body})
        return True
    if not is_configured():
        logger.info(f"[SMS disabled - no Twilio creds] To: {to[:4]}*** | {body[:40]}")
        return False
    try:
        sid = settings.twilio_account_sid
        resp = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            data={"To": to, "From": settings.twilio_from_number, "Body": body},
            auth=(sid, settings.twilio_auth_token),
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error(f"Failed to send SMS: {exc}")
        return False
