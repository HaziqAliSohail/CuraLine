"""
NPI (National Provider Identifier) verification against the CMS NPI Registry.

The registry is a free public API maintained by the US Centers for Medicare &
Medicaid Services: https://npiregistry.cms.hhs.gov/api/
No API key required.

Failure philosophy: a registry outage must never block onboarding - lookups
return an explicit ERROR status and the admin can fall back to manual review.
"""
import httpx
from loguru import logger

NPI_REGISTRY_URL = "https://npiregistry.cms.hhs.gov/api/"

# Verification statuses stored on Doctor.npi_verification_status
UNVERIFIED = "UNVERIFIED"   # no check run yet
VERIFIED = "VERIFIED"       # NPI found and name matches
MISMATCH = "MISMATCH"       # NPI found but registered to a different name
NOT_FOUND = "NOT_FOUND"     # NPI not in the registry
ERROR = "ERROR"             # registry unreachable - manual review needed


def _fetch_registry(npi_number: str) -> dict:
    """Raw registry call - isolated so tests can monkeypatch it."""
    resp = httpx.get(
        NPI_REGISTRY_URL,
        params={"version": "2.1", "number": npi_number},
        # Short timeout: this runs inline in the apply request. A slow registry
        # degrades to ERROR -> the application falls back to manual review.
        timeout=4,
    )
    resp.raise_for_status()
    return resp.json()


def _normalize(name: str) -> set[str]:
    """Lower-cased name tokens with titles stripped, for loose matching."""
    drop = {"dr", "dr.", "md", "m.d.", "do", "d.o."}
    return {t.strip(".,").lower() for t in name.split() if t.strip(".,").lower() not in drop}


def verify_npi(npi_number: str, doctor_name: str) -> dict:
    """Check an NPI against the CMS registry and loosely match the name.

    Returns {status, registry_name, taxonomy} - never raises.
    """
    try:
        data = _fetch_registry(npi_number)
    except Exception as exc:
        logger.warning(f"NPI registry lookup failed for {npi_number}: {exc}")
        return {"status": ERROR, "registry_name": None, "taxonomy": None}

    results = data.get("results") or []
    if data.get("result_count", 0) == 0 or not results:
        return {"status": NOT_FOUND, "registry_name": None, "taxonomy": None}

    basic = results[0].get("basic", {})
    # Individual providers have first/last; organizations have organization_name
    registry_name = (
        f"{basic.get('first_name', '')} {basic.get('last_name', '')}".strip()
        or basic.get("organization_name", "")
    )
    taxonomies = results[0].get("taxonomies") or []
    primary_taxonomy = next(
        (t.get("desc") for t in taxonomies if t.get("primary")),
        taxonomies[0].get("desc") if taxonomies else None,
    )

    # Loose match: any shared surname/forename token between the two names
    matched = bool(_normalize(doctor_name) & _normalize(registry_name)) if registry_name else False

    return {
        "status": VERIFIED if matched else MISMATCH,
        "registry_name": registry_name or None,
        "taxonomy": primary_taxonomy,
    }


def verify_org_npi(npi_number: str, org_name: str) -> dict:
    """Verify an ORGANIZATIONAL NPI (Type 2) for a hospital/clinic against the
    CMS registry. Returns {status, registry_name} - never raises."""
    try:
        data = _fetch_registry(npi_number)
    except Exception as exc:
        logger.warning(f"Org NPI lookup failed for {npi_number}: {exc}")
        return {"status": ERROR, "registry_name": None}

    results = data.get("results") or []
    if data.get("result_count", 0) == 0 or not results:
        return {"status": NOT_FOUND, "registry_name": None}

    res0 = results[0]
    basic = res0.get("basic", {})
    registry_name = basic.get("organization_name", "") or ""
    is_org = res0.get("enumeration_type") == "NPI-2"

    matched = is_org and bool(_normalize(org_name) & _normalize(registry_name)) if registry_name else False
    return {
        "status": VERIFIED if matched else MISMATCH,
        "registry_name": registry_name or None,
    }
