"""FHIR R4 mapping — export CuraLine records as interoperable FHIR resources.

This is a pure transform (no external system needed): it turns our Patient /
Appointment models into FHIR R4 resource dicts and a Bundle, the lingua franca
for EHR interoperability. A live push to an EHR's FHIR endpoint can be layered on
top later (gated on a configured base URL); the mapping is the hard part.
"""
from datetime import datetime

# Our status -> FHIR Appointment.status
_STATUS_MAP = {
    "SCHEDULED": "booked",
    "COMPLETED": "fulfilled",
    "CANCELLED": "cancelled",
    "NO_SHOW": "noshow",
}


def patient_resource(p) -> dict:
    parts = (p.name or "").strip().split()
    given = parts[:-1] if len(parts) > 1 else parts[:1]
    return {
        "resourceType": "Patient",
        "id": str(p.id),
        "name": [{"text": p.name, "family": parts[-1] if parts else "", "given": given}],
        "gender": (p.gender or "").lower() or "unknown",
        "telecom": [
            t for t in (
                {"system": "phone", "value": p.phone} if p.phone else None,
                {"system": "email", "value": p.email} if p.email else None,
            ) if t
        ],
    }


def appointment_resource(a) -> dict:
    res = {
        "resourceType": "Appointment",
        "id": str(a.id),
        "status": _STATUS_MAP.get(a.status, "booked"),
        "description": a.reason or None,
        "participant": [
            {"actor": {"reference": f"Patient/{a.patient_id}"}, "status": "accepted"},
            {"actor": {"reference": f"Practitioner/{a.doctor_id}"}, "status": "accepted"},
        ],
    }
    if a.slot:
        try:
            res["start"] = datetime.combine(a.slot.date, a.slot.start_time).isoformat()
        except Exception:
            pass
    return res


def appointment_bundle(appt, patient) -> dict:
    return {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
            {"resource": patient_resource(patient)},
            {"resource": appointment_resource(appt)},
        ],
    }
