"""Copay payments via Stripe Checkout.

Feature-flagged on STRIPE_SECRET_KEY. Without it, create_checkout reports the
feature disabled (sandbox). Uses Stripe Checkout Sessions (a hosted, redirect
flow) so the frontend just sends the patient to a URL — no client-side Stripe
SDK or card handling on our side. Uses the Stripe REST API over httpx. Never
raises. The backend never moves money directly.
"""
import os

import httpx
from loguru import logger

from settings import settings

_API = "https://api.stripe.com/v1/checkout/sessions"


def is_configured() -> bool:
    return bool(settings.stripe_secret_key.strip())


def create_checkout(amount_cents: int, success_url: str, cancel_url: str, metadata: dict | None = None) -> dict:
    """Create a Stripe Checkout Session. Returns {enabled, url, amount, sandbox}.
    Never raises."""
    if not is_configured():
        return {"enabled": False, "url": None, "amount": amount_cents, "sandbox": True}
    try:
        data = {
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "line_items[0][quantity]": 1,
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][unit_amount]": amount_cents,
            "line_items[0][price_data][product_data][name]": "CuraLine visit copay",
        }
        for k, v in (metadata or {}).items():
            data[f"metadata[{k}]"] = v
        resp = httpx.post(_API, data=data, auth=(settings.stripe_secret_key, ""), timeout=10)
        resp.raise_for_status()
        return {"enabled": True, "url": resp.json().get("url"), "amount": amount_cents, "sandbox": False}
    except Exception as exc:
        logger.error(f"Stripe Checkout session creation failed: {exc}")
        return {"enabled": False, "url": None, "amount": amount_cents, "sandbox": False}
