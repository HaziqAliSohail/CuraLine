"""Slot-timing helpers shared by the booking, triage and reschedule paths.

Two concepts live here:

  • Booking cutoff - a slot may only be *newly booked* until ``closes_before_minutes``
    before it starts. After that (and once it has started/passed) it is no longer
    bookable.

  • Travel / lock-in window - an appointment that starts within
    ``settings.reschedule_lock_minutes`` of now is "locked in": the patient may
    already be on their way, so it must never be swapped out from under them, and
    a slot freeing up this soon is not offered to anyone who would need to travel.

Slot dates/times are stored naive (clinic-local), so we compare against a naive
local ``datetime.now()`` consistently.
"""
from datetime import datetime, timedelta

from settings import settings


def slot_start(slot) -> datetime:
    """Naive local datetime at which the slot begins."""
    return datetime.combine(slot.date, slot.start_time)


def booking_cutoff(slot) -> datetime:
    """Latest moment a slot may still be newly booked."""
    return slot_start(slot) - timedelta(minutes=slot.closes_before_minutes or 0)


def is_bookable(slot, now: datetime | None = None) -> bool:
    """True only while we're still before the slot's booking cutoff - i.e. it
    hasn't started, isn't in the past, and isn't inside its closing window."""
    now = now or datetime.now()
    return now < booking_cutoff(slot)


def lock_horizon(now: datetime | None = None) -> datetime:
    """Appointments starting at or before this moment are locked in."""
    now = now or datetime.now()
    return now + timedelta(minutes=settings.reschedule_lock_minutes)


def is_locked_in(slot, now: datetime | None = None) -> bool:
    """True if the slot starts within the travel/lock window (or already
    started) - such appointments are protected from severity swaps."""
    return slot_start(slot) <= lock_horizon(now)
