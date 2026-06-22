from datetime import date, timedelta

from tasks.celery import celery


@celery.task(name="send_email_task", queue="worker-queue", max_retries=3, default_retry_delay=30)
def send_email_task(to: str, subject: str, text: str):
    """Async email delivery with retry on transient SMTP failures."""
    from clients.emailer import send_email, is_configured
    sent = send_email(to, subject, text)
    # Only retry when a configured server failed - an unconfigured dev
    # environment returning False is expected, not transient.
    if not sent and is_configured():
        raise send_email_task.retry()


@celery.task(name="send_appointment_reminders", queue="worker-queue")
def send_appointment_reminders():
    """Daily sweep: remind every patient with a SCHEDULED appointment tomorrow.

    Idempotent - each appointment is flagged once via reminder_sent, so the
    task can run on any schedule without double-sending.
    """
    from loguru import logger
    from clients import emailer
    from database.db import connection
    from models.appointment import Appointment
    from models.doctor_slot import DoctorSlot

    tomorrow = date.today() + timedelta(days=1)
    db = connection()
    try:
        due = (
            db.query(Appointment)
            .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
            .filter(
                Appointment.status == Appointment.SCHEDULED,
                Appointment.reminder_sent == False,  # noqa: E712
                DoctorSlot.date == tomorrow,
            )
            .all()
        )
        from clients import push

        sent = 0
        for appt in due:
            patient = appt.patient
            if not patient:
                appt.reminder_sent = True  # orphaned row; don't re-scan forever
                continue
            slot_info = f"{appt.slot.date} at {appt.slot.start_time.strftime('%I:%M %p')}"
            doctor_name = appt.doctor.name if appt.doctor else "your doctor"
            if patient.email:
                emailer.appointment_reminder(patient.email, patient.name, doctor_name, slot_info)
            if patient.phone:
                from clients import sms
                sms.send_sms(
                    patient.phone,
                    f"CuraLine reminder: appointment with {doctor_name} on {slot_info}. "
                    "Arrive 10 min early. Reply STOP to opt out.",
                )
            push.notify_subject(
                db, patient.id, "patient",
                "Appointment tomorrow",
                f"{doctor_name} - {slot_info}. Arrive 10 minutes early.",
                {"screen": "Visits"},
            )
            appt.reminder_sent = True
            sent += 1
        db.commit()
        if sent:
            logger.info(f"Sent {sent} appointment reminder(s) for {tomorrow}.")
        return sent
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
