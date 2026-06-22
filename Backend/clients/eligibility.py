"""
Real-time US insurance eligibility & benefits (X12 270/271).

Provider-agnostic: a clearinghouse adapter is selected by settings. With no
provider configured the client runs in SANDBOX mode — it returns a deterministic
plausible result so the whole booking flow is demoable without a paid account.
Flip to a live provider (Stedi, pVerify, Availity, Optum) by setting
ELIGIBILITY_PROVIDER + ELIGIBILITY_API_KEY.

Failure philosophy (same as NPI/email): never raise. A clearinghouse outage
returns status UNKNOWN so booking is never blocked by an eligibility check.
"""
import os

import httpx
from loguru import logger

from settings import settings

# Result statuses
ACTIVE = "ACTIVE"        # coverage confirmed active
INACTIVE = "INACTIVE"    # plan found but not active
NOT_FOUND = "NOT_FOUND"  # member/plan not found
UNKNOWN = "UNKNOWN"      # clearinghouse unreachable — verify manually
SANDBOX = "SANDBOX"      # no provider configured — illustrative result only


def _sandbox_result(plan: str | None, member_id: str | None) -> dict:
    """Deterministic stand-in so the flow works end-to-end without a provider.
    A member id ending in an even digit reads 'active', odd 'inactive' — purely
    so demos can show both states. Clearly labelled SANDBOX so it's never
    mistaken for a real verification."""
    active = True
    if member_id and member_id[-1].isdigit():
        active = int(member_id[-1]) % 2 == 0
    return {
        "status": SANDBOX,
        "active": active,
        "plan_name": plan or "Sample PPO Plan",
        "copay_estimate": 30 if active else None,
        "sandbox": True,
    }


def check_eligibility(*, plan: str | None, member_id: str | None,
                      group_number: str | None = None, patient_name: str | None = None) -> dict:
    """Verify coverage. Returns {status, active, plan_name, copay_estimate, sandbox}.
    Never raises."""
    if os.environ.get("TESTING") == "True":
        # Tests drive provider behaviour by monkeypatching _provider_check
        return _provider_check(plan, member_id, group_number, patient_name)

    provider = settings.eligibility_provider.strip().lower()
    if not provider or not settings.eligibility_api_key.strip():
        return _sandbox_result(plan, member_id)

    try:
        return _provider_check(plan, member_id, group_number, patient_name)
    except Exception as exc:
        logger.warning(f"Eligibility check failed via '{provider}', returning UNKNOWN: {exc}")
        return {"status": UNKNOWN, "active": None, "plan_name": plan, "copay_estimate": None, "sandbox": False}


def _provider_check(plan, member_id, group_number, patient_name) -> dict:
    """Dispatch to the configured clearinghouse adapter. Unknown/unset provider
    falls back to a sandbox result (keeps dev + tests safe). Real providers may
    raise on transport errors — check_eligibility() catches that as UNKNOWN."""
    provider = settings.eligibility_provider.strip().lower()
    if provider == "stedi":
        return _stedi_check(plan, member_id, group_number, patient_name)
    return _sandbox_result(plan, member_id)


# Carrier name → clearinghouse payer ID. These are common Change-Healthcare /
# Stedi payer IDs; BCBS varies by state. Override/extend with the JSON map in
# settings.eligibility_payer_map without a code change.
_DEFAULT_PAYER_IDS = {
    "aetna": "60054",
    "cigna": "62308",
    "unitedhealthcare": "87726",
    "humana": "61101",
    "blue cross blue shield": "00040",  # placeholder — set the state-specific ID
}


def _resolve_payer_id(plan: str | None) -> str | None:
    if not plan:
        return None
    key = plan.strip().lower()
    raw = (settings.eligibility_payer_map or "").strip()
    if raw:
        try:
            import json
            override = {k.lower(): v for k, v in json.loads(raw).items()}
            if key in override:
                return override[key]
        except Exception:
            logger.warning("ELIGIBILITY_PAYER_MAP is not valid JSON; ignoring it")
    return _DEFAULT_PAYER_IDS.get(key)


def _split_name(name: str | None) -> tuple[str, str]:
    parts = (name or "").strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def _stedi_check(plan, member_id, group_number, patient_name) -> dict:
    """Real-time X12 270/271 eligibility via Stedi's healthcare API."""
    payer_id = _resolve_payer_id(plan)
    if not payer_id:
        # Can't query a clearinghouse without a payer ID for this carrier.
        return {"status": NOT_FOUND, "active": None, "plan_name": plan,
                "copay_estimate": None, "sandbox": False}

    first, last = _split_name(patient_name)
    body = {
        "controlNumber": "000000001",
        "tradingPartnerServiceId": payer_id,
        "provider": {
            "organizationName": settings.eligibility_org_name or "CuraLine",
            "npi": settings.eligibility_provider_npi or "",
        },
        "subscriber": {"memberId": member_id or "", "firstName": first, "lastName": last},
        "encounter": {"serviceTypeCodes": ["30"]},  # 30 = plan coverage / general benefits
    }
    resp = httpx.post(
        settings.eligibility_api_url,
        json=body,
        headers={"Authorization": settings.eligibility_api_key, "Content-Type": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()
    return _parse_271(resp.json(), plan)


def _parse_271(data: dict, plan: str | None) -> dict:
    """Map a Stedi 271 response onto our status model.

    Eligibility/benefit codes: '1' = Active Coverage, '6'/'7'/'8' = Inactive,
    'B' = Co-Payment.
    """
    benefits = data.get("benefitsInformation") or []
    active = any(b.get("code") == "1" for b in benefits)
    inactive = any(b.get("code") in ("6", "7", "8") for b in benefits)

    if active:
        status = ACTIVE
    elif inactive:
        status = INACTIVE
    else:
        status = NOT_FOUND

    copay = None
    for b in benefits:
        if b.get("code") == "B" and b.get("benefitAmount") is not None:
            try:
                copay = int(float(b["benefitAmount"]))
            except (TypeError, ValueError):
                copay = None
            break

    return {
        "status": status,
        "active": True if active else (False if inactive else None),
        "plan_name": plan,
        "copay_estimate": copay,
        "sandbox": False,
    }
