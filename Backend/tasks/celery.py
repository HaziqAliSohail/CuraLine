from celery import Celery

from settings import settings

celery = Celery(__name__)
celery.conf.broker_url = settings.redis_url
celery.conf.result_backend = settings.redis_url
# Ensure the worker registers all task modules at startup (the worker is
# launched with "-A tasks.celery.celery", which imports only this module).
celery.conf.imports = (
    "tasks.chat_tasks",
    "tasks.slot_tasks",
    "tasks.email_tasks",
)
celery.conf.beat_schedule = {
    "auto-close-expired-slots": {
        "task": "auto_close_expired_slots",
        "schedule": 60.0,
    },
    # Hourly sweep; idempotent (reminder_sent flag), reminds for next-day visits
    "send-appointment-reminders": {
        "task": "send_appointment_reminders",
        "schedule": 3600.0,
    },
}
