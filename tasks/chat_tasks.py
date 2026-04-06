import json
from datetime import date

from celery_singleton import Singleton

from tasks.celery import celery


@celery.task(name="chat_execution_task", base=Singleton, queue="worker-queue")
def chat_execution_task(patient_id: int, conversation_history: list, collected_fields: dict):
    """
    Full AI-powered booking pipeline:
    1. Run intake LLM call to gather symptom information
    2. If ready, run severity analysis LLM call
    3. Select optimal slot based on severity vs existing bookings
    4. Book the appointment
    5. If severity >= 4, create reschedule requests for lower-priority patients in early slots
    Returns: dict with is_booked, appointment_id, reply, severity_score
    """
    from clients import llm_client
    from clients.prompts import INTAKE_SYSTEM_PROMPT, SEVERITY_SYSTEM_PROMPT
    from database.db import connection
    from models.appointment import Appointment
    from models.doctor import Doctor
    from models.doctor_slot import DoctorSlot
    from models.patient import Patient
    from models.reschedule_request import RescheduleRequest

    db = connection()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return {"is_booked": False, "reply": "Patient not found.", "severity_score": 0}

        # Step 1: Intake LLM call
        intake_response = llm_client.query_structured(
            messages=conversation_history,
            system_prompt=INTAKE_SYSTEM_PROMPT,
        )

        if "error" in intake_response:
            return {"is_booked": False, "reply": "I'm having trouble connecting. Please try again.", "severity_score": 0}

        collected = {**collected_fields, **intake_response.get("collected", {})}
        reply = intake_response.get("reply", "")
        ready = intake_response.get("ready_to_analyze", False)

        if not ready:
            return {
                "is_booked": False,
                "reply": reply,
                "severity_score": 0,
                "collected": collected,
                "stage": "intake",
            }

        # Step 2: Severity analysis
        history_context = patient.medical_history or "No prior medical history on file."
        severity_messages = [
            {
                "role": "user",
                "content": (
                    f"Patient medical history: {history_context}\n\n"
                    f"Current symptoms: {json.dumps(collected)}"
                ),
            }
        ]
        severity_response = llm_client.query_structured(
            messages=severity_messages,
            system_prompt=SEVERITY_SYSTEM_PROMPT,
        )

        if "error" in severity_response:
            return {"is_booked": False, "reply": "Unable to analyze severity. Please try again.", "severity_score": 0}

        severity_score = severity_response.get("severity_score", 1)
        recommended_specialization = severity_response.get("recommended_specialization", "General Medicine")
        analysis_summary = severity_response.get("analysis_summary", "")
        is_emergency = severity_response.get("is_emergency", False)

        if is_emergency:
            return {
                "is_booked": False,
                "reply": (
                    f"URGENT: Based on your symptoms, you may need emergency care. "
                    f"Please call emergency services (911) or go to the nearest ER immediately. "
                    f"Analysis: {analysis_summary}"
                ),
                "severity_score": severity_score,
                "stage": "emergency",
            }

        # Step 3: Find available slots matching specialization
        today = date.today()
        available_slots = (
            db.query(DoctorSlot)
            .join(Doctor, DoctorSlot.doctor_id == Doctor.id)
            .filter(
                DoctorSlot.is_available == True,  # noqa: E712
                DoctorSlot.date >= today,
                Doctor.availability_status == Doctor.AVAILABLE,
                Doctor.specialization.ilike(f"%{recommended_specialization}%"),
            )
            .order_by(DoctorSlot.date, DoctorSlot.start_time)
            .all()
        )

        if not available_slots:
            return {
                "is_booked": False,
                "reply": (
                    f"I've assessed your condition (severity: {severity_score}/5). "
                    f"Unfortunately, no {recommended_specialization} slots are available right now. "
                    f"Please call the hospital directly for urgent care."
                ),
                "severity_score": severity_score,
                "stage": "no_slots",
            }

        # Step 4: Select best slot — find slot where patient has highest relative priority
        best_slot = None
        for slot in available_slots:
            existing_appointments = (
                db.query(Appointment)
                .filter(
                    Appointment.slot_id == slot.id,
                    Appointment.status == Appointment.SCHEDULED,
                )
                .all()
            )
            # Prefer slots with lower average severity (so critical patient stands out)
            avg_severity = (
                sum(a.severity_score for a in existing_appointments) / len(existing_appointments)
                if existing_appointments else 0
            )
            if severity_score >= avg_severity:
                best_slot = slot
                break

        if not best_slot:
            best_slot = available_slots[0]

        # Step 5: Book the appointment
        reason_text = collected.get("chief_complaint", "Not specified")
        appointment = Appointment(
            patient_id=patient_id,
            doctor_id=best_slot.doctor_id,
            slot_id=best_slot.id,
            reason=reason_text,
            severity_score=severity_score,
            status=Appointment.SCHEDULED,
        )
        db.add(appointment)
        db.flush()
        db.refresh(appointment)

        # Step 6: Critical rescheduling — if severity >= 4, ask lower-priority patients in early slots to move
        if severity_score >= 4:
            earlier_slots = (
                db.query(DoctorSlot)
                .join(Doctor, DoctorSlot.doctor_id == Doctor.id)
                .filter(
                    DoctorSlot.date <= best_slot.date,
                    DoctorSlot.is_available == True,  # noqa: E712
                    Doctor.specialization.ilike(f"%{recommended_specialization}%"),
                    DoctorSlot.id != best_slot.id,
                )
                .order_by(DoctorSlot.date, DoctorSlot.start_time)
                .limit(3)
                .all()
            )

            for early_slot in earlier_slots:
                lower_priority_appts = (
                    db.query(Appointment)
                    .filter(
                        Appointment.slot_id == early_slot.id,
                        Appointment.status == Appointment.SCHEDULED,
                        Appointment.severity_score < severity_score,
                        Appointment.reschedule_requested == False,  # noqa: E712
                    )
                    .order_by(Appointment.severity_score)
                    .first()
                )
                if lower_priority_appts:
                    reschedule_req = RescheduleRequest(
                        triggering_appointment_id=appointment.id,
                        target_appointment_id=lower_priority_appts.id,
                        proposed_slot_id=best_slot.id,
                        status=RescheduleRequest.PENDING,
                    )
                    db.add(reschedule_req)
                    lower_priority_appts.reschedule_requested = True

        db.commit()

        slot_info = f"{best_slot.date} at {best_slot.start_time.strftime('%I:%M %p')}"
        doctor = db.query(Doctor).filter(Doctor.id == best_slot.doctor_id).first()
        doctor_name = doctor.name if doctor else "your assigned doctor"

        reply = (
            f"Your appointment has been booked!\n\n"
            f"- Doctor: {doctor_name} ({recommended_specialization})\n"
            f"- Date & Time: {slot_info}\n"
            f"- Severity Assessment: {severity_score}/5 — {analysis_summary}\n\n"
            f"Please arrive 10 minutes early. Take care!"
        )

        return {
            "is_booked": True,
            "appointment_id": appointment.id,
            "reply": reply,
            "severity_score": severity_score,
            "slot_info": slot_info,
            "stage": "complete",
        }

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


@celery.task(name="send_reschedule_notification", queue="worker-queue")
def send_reschedule_notification(reschedule_request_id: int):
    """Notify a patient that they have been asked to reschedule."""
    from database.db import connection
    from models.reschedule_request import RescheduleRequest

    db = connection()
    try:
        req = db.query(RescheduleRequest).filter(RescheduleRequest.id == reschedule_request_id).first()
        if not req:
            return

        patient = req.target_appointment.patient
        proposed_slot = req.proposed_slot
        slot_info = f"{proposed_slot.date} at {proposed_slot.start_time.strftime('%I:%M %p')}"

        # In production, send email/SMS here. For now, log the notification.
        print(
            f"[RESCHEDULE REQUEST] Patient {patient.name} ({patient.email}): "
            f"A critical patient needs your slot. "
            f"You are requested to move to {slot_info}. "
            f"Please accept or decline via the portal."
        )
    finally:
        db.close()
