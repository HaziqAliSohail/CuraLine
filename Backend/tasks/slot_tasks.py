from datetime import date, datetime, timedelta

from tasks.celery import celery


@celery.task(name="auto_close_expired_slots", queue="worker-queue")
def auto_close_expired_slots():
    from database.db import connection
    from models.doctor_slot import DoctorSlot

    session = connection()
    try:
        now = datetime.now()
        today = date.today()
        slots = (
            session.query(DoctorSlot)
            .filter(DoctorSlot.date == today, DoctorSlot.is_available == True)  # noqa: E712
            .all()
        )
        for slot in slots:
            slot_datetime = datetime.combine(slot.date, slot.start_time)
            close_at = slot_datetime - timedelta(minutes=slot.closes_before_minutes)
            if now >= close_at:
                slot.is_available = False
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@celery.task(name="purge_old_phi", queue="worker-queue")
def purge_old_phi():
    """Data-minimization: strip PHI from old, finished visits.

    After PHI_RETENTION_DAYS, remove the symptom transcript, chief complaint, and
    clinical notes from appointments that are done (completed/cancelled/no-show).
    The row itself stays (status/severity/dates) so analytics + doctor history are
    intact, but the identifiable health content is gone. Disabled when the setting
    is 0.
    """
    from loguru import logger
    from settings import settings

    days = settings.phi_retention_days
    if not days or days <= 0:
        return  # retention disabled

    from database.db import connection
    from models.appointment import Appointment
    from models.doctor_slot import DoctorSlot

    cutoff = date.today() - timedelta(days=days)
    terminal = [Appointment.COMPLETED, Appointment.CANCELLED, Appointment.NO_SHOW]

    session = connection()
    try:
        appts = (
            session.query(Appointment)
            .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
            .filter(Appointment.status.in_(terminal), DoctorSlot.date < cutoff)
            .all()
        )
        purged = 0
        for a in appts:
            if a.conversation_history or a.clinical_summary or a.reason or a.no_show_risk_reason:
                a.conversation_history = None
                a.clinical_summary = None
                a.no_show_risk_reason = None
                a.reason = None
                purged += 1
        if purged:
            session.commit()
        logger.info(f"[PHI RETENTION] purged PHI from {purged} appointment(s) older than {days}d")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
