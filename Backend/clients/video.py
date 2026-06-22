"""Telehealth video rooms via Daily.co.

Feature-flagged on DAILY_API_KEY: with no key the app reports the feature as
disabled (sandbox) so the rest of the app is unaffected. Never raises — a
provider error degrades to "not available" rather than blocking the visit.
"""
import httpx
from loguru import logger

from settings import settings

_API = "https://api.daily.co/v1/rooms"


def is_enabled() -> bool:
    return bool(settings.daily_api_key.strip())


def get_room(appointment_id: int, existing_url: str | None = None) -> dict:
    """Return {enabled, url, sandbox} for an appointment's video room, creating
    the room on first request. `existing_url` is the persisted room (if any)."""
    if not is_enabled():
        return {"enabled": False, "url": None, "sandbox": True}
    if existing_url:
        return {"enabled": True, "url": existing_url, "sandbox": False}
    try:
        url = _create_room(f"curaline-appt-{appointment_id}")
        return {"enabled": True, "url": url, "sandbox": False}
    except Exception as exc:
        logger.warning(f"Daily room creation failed for appt {appointment_id}: {exc}")
        return {"enabled": False, "url": None, "sandbox": False}


def _create_room(name: str) -> str:
    headers = {"Authorization": f"Bearer {settings.daily_api_key}"}
    # Private, auto-expiring room (24h). If the name already exists, fetch it.
    import time
    payload = {
        "name": name,
        "privacy": "private",
        "properties": {"exp": int(time.time()) + 86400, "enable_chat": True},
    }
    resp = httpx.post(_API, json=payload, headers=headers, timeout=10)
    if resp.status_code == 200:
        return resp.json()["url"]
    # Already created (or name clash) -> fetch the existing room.
    got = httpx.get(f"{_API}/{name}", headers=headers, timeout=10)
    got.raise_for_status()
    return got.json()["url"]
