"""Lightweight, PII-safe product analytics.

`track(event, distinct_id, **properties)` records funnel/outcome events so the
hero metrics (conversion, severity mix, no-show rate, time-to-care) are measured
rather than asserted.

Sinks, in order:
  • TESTING  -> captured in EVENTS for assertions
  • PostHog  -> if POSTHOG_API_KEY is set (best-effort HTTP, never blocks/raises)
  • else     -> a structured log line

⚠️ NEVER pass PHI (symptom text, names, emails) as properties — only structured,
non-identifying fields like severity, specialization, status, booleans, counts.
"""
import os

from loguru import logger

from settings import settings

EVENTS: list[dict] = []  # test capture


def track(event: str, distinct_id=None, **properties) -> None:
    did = str(distinct_id) if distinct_id is not None else "anonymous"
    try:
        if os.environ.get("TESTING") == "True":
            EVENTS.append({"event": event, "distinct_id": did, "properties": properties})
            return

        if settings.posthog_api_key:
            import httpx
            httpx.post(
                f"{settings.posthog_host.rstrip('/')}/capture/",
                json={
                    "api_key": settings.posthog_api_key,
                    "event": event,
                    "distinct_id": did,
                    "properties": properties,
                },
                timeout=1.5,
            )
        else:
            logger.info(f"[analytics] {event} id={did} {properties}")
    except Exception as exc:  # analytics must never break a request/task
        logger.debug(f"analytics track failed for {event}: {exc}")
