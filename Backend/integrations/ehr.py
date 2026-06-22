"""
EHR synchronization seam (enterprise tier - INACTIVE until a hospital customer).

This module defines the contract CuraLine will use to push/pull scheduling
data to a hospital's EHR (Epic, athenahealth, drchrono, ...). It is
deliberately NOT wired into any request path yet: speculative integrations in
the booking hot path are risk with no payoff until a real EHR sandbox exists.

When the first hospital signs:
1. Implement an adapter (e.g. EpicFHIRAdapter) against this protocol using
   their FHIR R4 Scheduling endpoints (Slot, Appointment resources).
2. Wire `get_ehr_adapter()` calls into slot creation/closing and appointment
   booking/cancellation, behind a per-hospital feature flag.
3. See docs/ehr-integration.md for the full integration plan.
"""
from typing import Protocol

from loguru import logger


class EHRSyncAdapter(Protocol):
    """Contract for two-way scheduling sync with an external EHR."""

    def push_slot_opened(self, slot_id: int) -> None: ...
    def push_slot_closed(self, slot_id: int) -> None: ...
    def push_appointment_booked(self, appointment_id: int) -> None: ...
    def push_appointment_cancelled(self, appointment_id: int) -> None: ...
    def pull_availability(self, doctor_id: int) -> list[dict]: ...


class NullEHRAdapter:
    """Default adapter: does nothing. Keeps call sites trivially safe to add."""

    def push_slot_opened(self, slot_id: int) -> None:
        pass

    def push_slot_closed(self, slot_id: int) -> None:
        pass

    def push_appointment_booked(self, appointment_id: int) -> None:
        pass

    def push_appointment_cancelled(self, appointment_id: int) -> None:
        pass

    def pull_availability(self, doctor_id: int) -> list[dict]:
        return []


_adapter: EHRSyncAdapter = NullEHRAdapter()


def get_ehr_adapter() -> EHRSyncAdapter:
    return _adapter


def set_ehr_adapter(adapter: EHRSyncAdapter) -> None:
    global _adapter
    logger.info(f"EHR adapter set to {type(adapter).__name__}")
    _adapter = adapter
