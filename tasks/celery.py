from celery import Celery

from settings import settings

celery = Celery(__name__)
celery.conf.broker_url = settings.redis_url
celery.conf.result_backend = settings.redis_url
celery.conf.beat_schedule = {
    "auto-close-expired-slots": {
        "task": "auto_close_expired_slots",
        "schedule": 60.0,
    },
}
