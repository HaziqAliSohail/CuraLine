"""
Push notifications via the Expo Push API.

Why Expo Push: the mobile app is an Expo client, and Expo's service fronts
both FCM (Android) and APNs (iOS) behind one free HTTPS endpoint - no Firebase
project or Apple key handling in our backend.
Docs: https://docs.expo.dev/push-notifications/sending-notifications/

Failure philosophy (same as the emailer): a push failure must never break the
flow that triggered it. In TESTING mode notifications are captured in OUTBOX.
"""
import os

import httpx
from loguru import logger

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Test-mode capture: list of dicts {to, title, body, data}
OUTBOX: list[dict] = []


def _post_expo(messages: list[dict]) -> None:
    """Raw Expo API call - isolated so tests can monkeypatch it."""
    resp = httpx.post(EXPO_PUSH_URL, json=messages, timeout=10)
    resp.raise_for_status()


def send_to_tokens(tokens: list[str], title: str, body: str, data: dict | None = None) -> int:
    """Send a notification to a list of Expo push tokens. Returns count sent.
    Never raises."""
    if not tokens:
        return 0

    if os.environ.get("TESTING") == "True":
        for t in tokens:
            OUTBOX.append({"to": t, "title": title, "body": body, "data": data or {}})
        return len(tokens)

    messages = [
        {"to": t, "title": title, "body": body, "data": data or {}, "sound": "default"}
        for t in tokens
    ]
    try:
        _post_expo(messages)
        return len(messages)
    except Exception as exc:
        logger.warning(f"Expo push send failed ({len(messages)} message(s)): {exc}")
        return 0


def notify_subject(db, subject_id: int, role: str, title: str, body: str, data: dict | None = None) -> int:
    """Push to every registered device of a patient/doctor. Never raises."""
    try:
        from models.device_token import DeviceToken
        tokens = [
            row.expo_push_token
            for row in db.query(DeviceToken).filter(
                DeviceToken.subject_id == subject_id,
                DeviceToken.role == role,
            )
        ]
        return send_to_tokens(tokens, title, body, data)
    except Exception as exc:
        logger.warning(f"Push notify failed for {role} {subject_id}: {exc}")
        return 0
