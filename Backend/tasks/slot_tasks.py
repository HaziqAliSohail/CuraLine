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
