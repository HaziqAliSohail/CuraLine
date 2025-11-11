from celery_singleton import Singleton

from tasks.celery import celery


@celery.task(name="chat_execution_task", base=Singleton, queue="worker_queue")
def chat_execution_task():
    print("hi")


