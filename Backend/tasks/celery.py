from celery import Celery

from settings import settings

celery = Celery(__name__)
celery.conf.broker_url = settings.redis_url
celery.conf.result_backend = settings.redis_url
# Chat results are polled by clients; expire them after an hour so Redis
# doesn't accumulate stale results.
celery.conf.result_expires = 3600
# Store task args/kwargs alongside results so the poll endpoint can verify the
# requesting patient owns the job (defence-in-depth on top of unguessable ids).
celery.conf.result_extended = True
# Fail fast when the broker is unreachable so the web layer can fall back to
# inline execution instead of hanging on connection retries.
celery.conf.broker_connection_retry_on_startup = False
celery.conf.broker_transport_options = {
    "socket_connect_timeout": 2,
    "socket_timeout": 2,
    "max_retries": 1,
}
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
    "auto-resolve-past-appointments": {
        "task": "auto_resolve_past_appointments",
        "schedule": 60.0,
    },
    # Hourly sweep; idempotent (reminder_sent flag), reminds for next-day visits
    "send-appointment-reminders": {
        "task": "send_appointment_reminders",
        "schedule": 3600.0,
    },
    # Daily PHI retention sweep (no-op unless PHI_RETENTION_DAYS is set)
    "purge-old-phi": {
        "task": "purge_old_phi",
        "schedule": 86400.0,
    },
}
