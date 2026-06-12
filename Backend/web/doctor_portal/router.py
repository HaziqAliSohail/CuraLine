from datetime import date as date_cls, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.appointment import Appointment
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from models.reschedule_request import RescheduleRequest
from web.auth.security import get_current_doctor, hash_password, verify_password
from web.doctor_portal.schemas import (
    BriefingOutSchema,
    BulkSlotCreateSchema,
    BulkSlotResultSchema,
    DoctorAnalyticsOutSchema,
    DoctorAppointmentOutSchema,
    DoctorRescheduleOutSchema,
    DoctorSlotCreateSchema,
    OutcomeUpdateSchema,
    PasswordChangeSchema,
)
from web.doctors.schemas import DoctorOutSchema
from web.slots.schemas import SlotOutSchema

doctor_portal_router = APIRouter()

# Morning briefings are stable for a given day — cache one LLM call per doctor
# per day in-process. {(doctor_id, iso_date): summary}
_briefing_cache: dict[tuple[int, str], str] = {}


def _build_appointment_out(appt: Appointment) -> dict:
    return {
        "id": appt.id,
        "status": appt.status,
        "reason": appt.reason,
        "severity_score": appt.severity_score,
        "slot_date": appt.slot.date if appt.slot else None,
        "slot_time": appt.slot.start_time if appt.slot else None,
        "duration_minutes": appt.slot.duration_minutes if appt.slot else None,
        "patient_name": appt.patient.name if appt.patient else None,
        "patient_gender": appt.patient.gender if appt.patient else None,
        "patient_phone": appt.patient.phone if appt.patient else None,
        "patient_medical_history": appt.patient.medical_history if appt.patient else None,
    }


@doctor_portal_router.get("/me", response_model=DoctorOutSchema)
def get_my_doctor_profile(current_doctor: Doctor = Depends(get_current_doctor)):
    return current_doctor


@doctor_portal_router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    body: PasswordChangeSchema,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    """Let doctors rotate the password set during provisioning/application, so
    no one else (including the admin) retains knowledge of their credentials."""
    if not current_doctor.password_hash or not verify_password(
        body.current_password, current_doctor.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current password is incorrect.",
        )
    current_doctor.password_hash = hash_password(body.new_password)
    db.flush()


@doctor_portal_router.get("/appointments", response_model=list[DoctorAppointmentOutSchema])
def list_my_appointments(
    day: date_cls | None = Query(default=None, description="Defaults to today"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    """The doctor's schedule for a day, in time order, with triage intelligence."""
    target_day = day or date_cls.today()
    appts = (
        db.query(Appointment)
        .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
        .filter(
            Appointment.doctor_id == current_doctor.id,
            DoctorSlot.date == target_day,
        )
        .order_by(DoctorSlot.start_time)
        .all()
    )
    return [_build_appointment_out(a) for a in appts]


@doctor_portal_router.put("/appointments/{appointment_id}/outcome", response_model=DoctorAppointmentOutSchema)
def record_appointment_outcome(
    appointment_id: int,
    body: OutcomeUpdateSchema,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    """One-tap visit outcome: COMPLETED or NO_SHOW. Doctors only — patients cannot
    mark their own visits as completed."""
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.doctor_id == current_doctor.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appt.status != Appointment.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only SCHEDULED appointments can be given an outcome.",
        )
    appt.status = body.status
    db.flush()
    return _build_appointment_out(appt)


# ── Slot self-service ────────────────────────────────────────────────


@doctor_portal_router.get("/slots", response_model=list[SlotOutSchema])
def list_my_slots(
    from_date: date_cls | None = Query(default=None),
    to_date: date_cls | None = Query(default=None),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    query = db.query(DoctorSlot).filter(DoctorSlot.doctor_id == current_doctor.id)
    query = query.filter(DoctorSlot.date >= (from_date or date_cls.today()))
    if to_date:
        query = query.filter(DoctorSlot.date <= to_date)
    return query.order_by(DoctorSlot.date, DoctorSlot.start_time).all()


@doctor_portal_router.post("/slots", response_model=SlotOutSchema, status_code=status.HTTP_201_CREATED)
def create_my_slot(
    body: DoctorSlotCreateSchema,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    duplicate = db.query(DoctorSlot).filter(
        DoctorSlot.doctor_id == current_doctor.id,
        DoctorSlot.date == body.date,
        DoctorSlot.start_time == body.start_time,
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a slot at this date and time.",
        )
    slot = DoctorSlot(doctor_id=current_doctor.id, is_available=True, **body.model_dump())
    db.add(slot)
    db.flush()
    db.refresh(slot)
    return slot


@doctor_portal_router.post("/slots/bulk", response_model=BulkSlotResultSchema, status_code=status.HTTP_201_CREATED)
def bulk_create_my_slots(
    body: BulkSlotCreateSchema,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    """Generate recurring slots ('every weekday 9-5, 30-min slots') in one call.
    Existing slots at the same date+time are skipped, so re-running is safe."""
    existing = {
        (s.date, s.start_time)
        for s in db.query(DoctorSlot).filter(
            DoctorSlot.doctor_id == current_doctor.id,
            DoctorSlot.date >= body.start_date,
            DoctorSlot.date <= body.end_date,
        )
    }

    created = 0
    skipped = 0
    current_day = body.start_date
    while current_day <= body.end_date:
        if current_day.isoweekday() in body.weekdays:
            cursor = datetime.combine(current_day, body.start_time)
            end = datetime.combine(current_day, body.end_time)
            while cursor + timedelta(minutes=body.duration_minutes) <= end:
                key = (current_day, cursor.time())
                if key in existing:
                    skipped += 1
                else:
                    db.add(DoctorSlot(
                        doctor_id=current_doctor.id,
                        date=current_day,
                        start_time=cursor.time(),
                        duration_minutes=body.duration_minutes,
                        closes_before_minutes=body.closes_before_minutes,
                        is_available=True,
                    ))
                    created += 1
                cursor += timedelta(minutes=body.duration_minutes)
        current_day += timedelta(days=1)

    db.flush()
    return {"created": created, "skipped_existing": skipped}


@doctor_portal_router.put("/slots/{slot_id}/close", response_model=SlotOutSchema)
def close_my_slot(
    slot_id: int,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    slot = db.query(DoctorSlot).filter(
        DoctorSlot.id == slot_id,
        DoctorSlot.doctor_id == current_doctor.id,
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found.")
    slot.is_available = False
    db.flush()
    db.refresh(slot)
    return slot


@doctor_portal_router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_slot(
    slot_id: int,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    slot = db.query(DoctorSlot).filter(
        DoctorSlot.id == slot_id,
        DoctorSlot.doctor_id == current_doctor.id,
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found.")
    booked = db.query(Appointment).filter(
        Appointment.slot_id == slot.id,
        Appointment.status == Appointment.SCHEDULED,
    ).first()
    if booked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A patient is booked on this slot. Close it or reschedule the patient instead.",
        )
    db.delete(slot)


# ── Morning briefing ─────────────────────────────────────────────────


def _deterministic_briefing(doctor_name: str, appts: list[Appointment]) -> str:
    if not appts:
        return f"Good morning, {doctor_name}. Your schedule is clear today — no appointments booked."
    critical = [a for a in appts if a.severity_score >= 4]
    parts = [f"Good morning, {doctor_name}. You have {len(appts)} patient{'s' if len(appts) != 1 else ''} today."]
    if critical:
        first = critical[0]
        slot_time = first.slot.start_time.strftime("%I:%M %p") if first.slot else "—"
        parts.append(
            f"{len(critical)} high-severity case{'s' if len(critical) != 1 else ''} — "
            f"first is {first.patient.name if first.patient else 'a patient'} at {slot_time} "
            f"({first.reason or 'no reason recorded'}, severity {first.severity_score}/5)."
        )
    else:
        parts.append("No high-severity cases — a routine day.")
    return " ".join(parts)


@doctor_portal_router.get("/briefing", response_model=BriefingOutSchema)
def morning_briefing(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    """Daily digest of today's schedule: case mix counts plus an AI-written
    one-paragraph briefing (one cached LLM call per doctor per day)."""
    today = date_cls.today()
    appts = (
        db.query(Appointment)
        .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
        .filter(
            Appointment.doctor_id == current_doctor.id,
            Appointment.status == Appointment.SCHEDULED,
            DoctorSlot.date == today,
        )
        .order_by(DoctorSlot.start_time)
        .all()
    )

    stats = {
        "date": today,
        "total_appointments": len(appts),
        "critical_count": sum(1 for a in appts if a.severity_score >= 4),
        "moderate_count": sum(1 for a in appts if a.severity_score == 3),
        "routine_count": sum(1 for a in appts if a.severity_score <= 2),
        "first_appointment_time": appts[0].slot.start_time if appts and appts[0].slot else None,
    }

    cache_key = (current_doctor.id, today.isoformat())
    if cache_key in _briefing_cache:
        return {**stats, "summary": _briefing_cache[cache_key]}

    summary = _deterministic_briefing(current_doctor.name, appts)
    if appts:
        try:
            from clients import llm_client
            from clients.prompts import BRIEFING_SYSTEM_PROMPT

            roster = "\n".join(
                f"- {a.slot.start_time.strftime('%H:%M') if a.slot else '??'} | "
                f"{a.patient.name if a.patient else 'Unknown'} | severity {a.severity_score}/5 | "
                f"{(a.reason or 'no reason recorded')[:120]}"
                for a in appts
            )
            ai_summary = llm_client.query(
                f"Doctor: {current_doctor.name} ({current_doctor.specialization})\n"
                f"Today's schedule:\n{roster}",
                system_prompt=BRIEFING_SYSTEM_PROMPT,
            )
            # The client returns error text rather than raising; only accept
            # plausible briefing prose.
            if ai_summary and "not configured" not in ai_summary and len(ai_summary) < 1200:
                summary = ai_summary.strip()
        except Exception as exc:
            logger.warning(f"Morning briefing LLM call failed, using fallback: {exc}")

    _briefing_cache[cache_key] = summary
    # Drop stale entries so the cache cannot grow unbounded
    stale = [k for k in _briefing_cache if k[1] != today.isoformat()]
    for k in stale:
        del _briefing_cache[k]

    return {**stats, "summary": summary}


# ── Practice analytics ───────────────────────────────────────────────


@doctor_portal_router.get("/analytics", response_model=DoctorAnalyticsOutSchema)
def practice_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    """No-show rate, case-mix, and scheduling patterns over a trailing window.

    Counts every appointment whose slot falls in [today - days, today].
    """
    today = date_cls.today()
    window_start = today - timedelta(days=days)

    appts = (
        db.query(Appointment)
        .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
        .filter(
            Appointment.doctor_id == current_doctor.id,
            DoctorSlot.date >= window_start,
            DoctorSlot.date <= today,
        )
        .all()
    )

    completed = sum(1 for a in appts if a.status == Appointment.COMPLETED)
    no_show = sum(1 for a in appts if a.status == Appointment.NO_SHOW)
    cancelled = sum(1 for a in appts if a.status == Appointment.CANCELLED)
    scheduled = sum(1 for a in appts if a.status == Appointment.SCHEDULED)

    decided = completed + no_show
    no_show_rate = round(no_show / decided * 100, 1) if decided else None

    # Case mix excludes cancellations — they never became visits
    attended_or_due = [a for a in appts if a.status != Appointment.CANCELLED]
    severity_counts = {s: 0 for s in range(1, 6)}
    for a in attended_or_due:
        severity_counts[max(1, min(5, a.severity_score or 1))] += 1
    avg_severity = (
        round(sum(a.severity_score or 1 for a in attended_or_due) / len(attended_or_due), 1)
        if attended_or_due else None
    )

    weekday_counts: dict[str, int] = {}
    for a in attended_or_due:
        if a.slot:
            day_name = a.slot.date.strftime("%A")
            weekday_counts[day_name] = weekday_counts.get(day_name, 0) + 1
    busiest_weekday = max(weekday_counts, key=weekday_counts.get) if weekday_counts else None

    return {
        "window_days": days,
        "total_appointments": len(appts),
        "completed": completed,
        "no_show": no_show,
        "cancelled": cancelled,
        "scheduled": scheduled,
        "no_show_rate": no_show_rate,
        "avg_severity": avg_severity,
        "severity_counts": severity_counts,
        "busiest_weekday": busiest_weekday,
    }


# ── Reschedule visibility ────────────────────────────────────────────


@doctor_portal_router.get("/reschedules", response_model=list[DoctorRescheduleOutSchema])
def list_reschedules_affecting_me(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db_session),
):
    """Pending severity-swaps touching this doctor's schedule, so calendar
    changes never feel like gremlins."""
    reqs = (
        db.query(RescheduleRequest)
        .join(Appointment, RescheduleRequest.triggering_appointment_id == Appointment.id)
        .filter(
            Appointment.doctor_id == current_doctor.id,
            RescheduleRequest.status == RescheduleRequest.PENDING,
        )
        .all()
    )
    out = []
    for r in reqs:
        target_slot = r.target_appointment.slot if r.target_appointment else None
        out.append({
            "id": r.id,
            "status": r.status,
            "severity_score": r.triggering_appointment.severity_score if r.triggering_appointment else None,
            "proposed_slot_date": r.proposed_slot.date if r.proposed_slot else None,
            "proposed_slot_time": r.proposed_slot.start_time if r.proposed_slot else None,
            "target_slot_date": target_slot.date if target_slot else None,
            "target_slot_time": target_slot.start_time if target_slot else None,
        })
    return out
