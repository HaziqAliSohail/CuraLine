"""Scheduled PHI retention purge (tasks.slot_tasks.purge_old_phi)."""
from datetime import date, time, timedelta

from models.appointment import Appointment
from models.doctor_slot import DoctorSlot


def _appt(db, patient, doctor, slot_date, status):
    slot = DoctorSlot(doctor_id=doctor.id, date=slot_date, start_time=time(9, 0),
                      duration_minutes=30, closes_before_minutes=15, is_available=False)
    db.add(slot); db.flush()
    a = Appointment(patient_id=patient.id, doctor_id=doctor.id, slot_id=slot.id,
                    status=status, reason="chest discomfort", severity_score=2,
                    conversation_history='[{"role":"user","content":"chest discomfort"}]',
                    clinical_summary="Patient note", no_show_risk_reason="low")
    db.add(a); db.flush()
    return a


def test_purge_strips_phi_from_old_finished_visits(db, monkeypatch, sample_patient, sample_doctor):
    from settings import settings as app_settings
    from tasks.slot_tasks import purge_old_phi
    monkeypatch.setattr(app_settings, "phi_retention_days", 30)

    old_done = _appt(db, sample_patient, sample_doctor, date.today() - timedelta(days=60), Appointment.COMPLETED)
    recent_done = _appt(db, sample_patient, sample_doctor, date.today() - timedelta(days=5), Appointment.COMPLETED)
    old_scheduled = _appt(db, sample_patient, sample_doctor, date.today() - timedelta(days=60), Appointment.SCHEDULED)
    db.commit()

    with monkeypatch.context() as m:
        m.setattr("database.db.connection", lambda: db)
        original_close = db.close
        db.close = lambda: None
        try:
            purge_old_phi()
        finally:
            db.close = original_close

    db.expire_all()
    assert db.get(Appointment,old_done.id).reason is None          # old + finished → purged
    assert db.get(Appointment,old_done.id).conversation_history is None
    assert db.get(Appointment,recent_done.id).reason is not None    # too recent → kept
    assert db.get(Appointment,old_scheduled.id).reason is not None  # not finished → kept


def test_purge_disabled_by_default(db, monkeypatch, sample_patient, sample_doctor):
    from settings import settings as app_settings
    from tasks.slot_tasks import purge_old_phi
    monkeypatch.setattr(app_settings, "phi_retention_days", 0)  # disabled

    a = _appt(db, sample_patient, sample_doctor, date.today() - timedelta(days=400), Appointment.COMPLETED)
    db.commit()

    with monkeypatch.context() as m:
        m.setattr("database.db.connection", lambda: db)
        original_close = db.close
        db.close = lambda: None
        try:
            purge_old_phi()
        finally:
            db.close = original_close

    db.expire_all()
    assert db.get(Appointment,a.id).reason is not None  # retention off → nothing purged
