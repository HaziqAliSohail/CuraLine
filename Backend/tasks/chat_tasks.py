import json
from datetime import date

from celery_singleton import Singleton
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from clients.urgent_guidance import match_urgent_guidance, GUIDANCE_DISCLAIMER
from tasks.celery import celery


def _llm_retry_decorator():
    """Retry LLM calls up to 3 times with exponential backoff."""
    return retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )


@celery.task(name="chat_execution_task", base=Singleton, queue="worker-queue")
def chat_execution_task(patient_id: int, conversation_history: list, collected_fields: dict):
    """
    Full AI-powered booking pipeline:
    1. Run intake LLM call to gather symptom information
    2. If ready, run severity analysis LLM call
    3. Select optimal slot based on severity vs existing bookings
    4. Book the appointment and lock the slot
    5. If severity >= 4, create reschedule requests for lower-priority patients in early slots
    6. Dispatch Celery notifications for each reschedule request
    Returns: dict with is_booked, appointment_id, reply, severity_score
    """
    from loguru import logger
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

        # Local Routing pre-filter to bypass LLM for simple turns
        from clients.router import match_local_routing
        latest_user_message = ""
        for m in reversed(conversation_history):
            if m.get("role") == "user":
                latest_user_message = m.get("content", "")
                break

        local_route = match_local_routing(latest_user_message, conversation_history, collected_fields)
        if local_route is not None:
            logger.info(f"Local routing intercepted message: '{latest_user_message}'")
            return local_route

        # Step 1: Intake LLM call (with retry using rolling history window to optimize token usage)
        pruned_history = conversation_history[-6:] if len(conversation_history) > 6 else conversation_history

        @_llm_retry_decorator()
        def _call_intake():
            return llm_client.query_structured(
                messages=pruned_history,
                system_prompt=INTAKE_SYSTEM_PROMPT,
            )

        try:
            intake_response = _call_intake()
        except Exception as exc:
            logger.error(f"Intake LLM call failed after retries: {exc}")
            return {"is_booked": False, "reply": "I'm having trouble connecting. Please try again.", "severity_score": 0}

        if "error" in intake_response:
            logger.error(f"Intake LLM call failed: {intake_response['error']}")
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

        # ── Urgent Guidance: match symptoms against knowledge base ──
        symptoms_text = " ".join([
            collected.get("chief_complaint", "") or "",
            " ".join(collected.get("symptoms", []) or []),
        ])
        guidance_match = match_urgent_guidance(symptoms_text)
        urgent_guidance = None
        guidance_type = None
        if guidance_match:
            urgent_guidance = f"{guidance_match['guidance']}\n\n{GUIDANCE_DISCLAIMER}"
            guidance_type = guidance_match["action"]

        # Step 2: Severity analysis (with retry)
        # Extract patient's preferred specialization (if they explicitly asked for one)
        patient_preferred_spec = collected.get("preferred_specialization") or None

        history_context = patient.medical_history or "No prior medical history on file."
        severity_user_content = (
            f"Patient medical history: {history_context}\n\n"
            f"Current symptoms: {json.dumps(collected)}"
        )
        if patient_preferred_spec:
            severity_user_content += f"\n\nPatient's preferred specialization: {patient_preferred_spec}"

        severity_messages = [
            {
                "role": "user",
                "content": severity_user_content,
            }
        ]

        @_llm_retry_decorator()
        def _call_severity():
            return llm_client.query_structured(
                messages=severity_messages,
                system_prompt=SEVERITY_SYSTEM_PROMPT,
            )

        try:
            severity_response = _call_severity()
        except Exception as exc:
            logger.error(f"Severity analysis LLM call failed after retries: {exc}")
            return {"is_booked": False, "reply": "Unable to analyze severity. Please try again.", "severity_score": 0}

        if "error" in severity_response:
            logger.error(f"Severity analysis LLM call failed: {severity_response['error']}")
            return {"is_booked": False, "reply": "Unable to analyze severity. Please try again.", "severity_score": 0}

        # Clamp severity score to valid range [1, 5]
        raw_score = severity_response.get("severity_score", 1)
        try:
            severity_score = max(1, min(5, int(raw_score)))
        except (TypeError, ValueError):
            severity_score = 1

        recommended_specialization = severity_response.get("recommended_specialization", "General Medicine")
        analysis_summary = severity_response.get("analysis_summary", "")
        is_emergency = severity_response.get("is_emergency", False)

        # Patient preference always wins (unless emergency)
        if patient_preferred_spec and not is_emergency:
            if recommended_specialization != patient_preferred_spec:
                logger.info(
                    f"Overriding LLM specialization '{recommended_specialization}' "
                    f"with patient preference '{patient_preferred_spec}'"
                )
                # Keep the LLM's clinical note in the summary, but honor the patient's choice
                if patient_preferred_spec.lower() not in analysis_summary.lower():
                    analysis_summary += f" (Note: AI had suggested {recommended_specialization}.)"
                recommended_specialization = patient_preferred_spec

        # Validate specialization against actual doctors in the database (fuzzy match)
        all_db_specs = [
            row[0] for row in
            db.query(Doctor.specialization).distinct().all()
        ]

        matched_spec = None
        for db_spec in all_db_specs:
            if db_spec.lower() == recommended_specialization.lower():
                matched_spec = db_spec
                break
        if not matched_spec:
            # Try partial match (e.g. "Cardio" -> "Cardiology")
            for db_spec in all_db_specs:
                if (recommended_specialization.lower() in db_spec.lower()
                        or db_spec.lower() in recommended_specialization.lower()):
                    matched_spec = db_spec
                    break

        if matched_spec:
            recommended_specialization = matched_spec
        else:
            # We don't have this specialist — tell the patient honestly
            available_list = ", ".join(sorted(all_db_specs))
            logger.info(
                f"Specialization '{recommended_specialization}' not available in our clinic. "
                f"Available: {available_list}"
            )
            return {
                "is_booked": False,
                "reply": (
                    f"Based on your symptoms, I'd recommend seeing a {recommended_specialization} specialist. "
                    f"Unfortunately, we don't currently have a {recommended_specialization} doctor at our clinic.\n\n"
                    f"Our available specializations are: {available_list}.\n\n"
                    f"Would you like to book with one of these instead, or would you prefer a referral?"
                ),
                "severity_score": severity_score,
                "stage": "no_specialist",
                "collected": collected,
                "urgent_guidance": urgent_guidance,
                "guidance_type": guidance_type,
            }

        if is_emergency:
            emergency_reply = (
                f"URGENT: Based on your symptoms, you may need emergency care. "
                f"Please call emergency services (911) or go to the nearest ER immediately. "
                f"Analysis: {analysis_summary}"
            )
            return {
                "is_booked": False,
                "reply": emergency_reply,
                "severity_score": severity_score,
                "stage": "emergency",
                "urgent_guidance": urgent_guidance,
                "guidance_type": guidance_type or "EMERGENCY",
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
                Doctor.application_status == Doctor.APPROVED,
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
                "urgent_guidance": urgent_guidance,
                "guidance_type": guidance_type,
            }

        # Step 4: Select best slot — prefer slots where the patient has highest relative priority
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
            avg_severity = (
                sum(a.severity_score for a in existing_appointments) / len(existing_appointments)
                if existing_appointments else 0
            )
            if severity_score >= avg_severity:
                best_slot = slot
                break

        if not best_slot:
            best_slot = available_slots[0]

        # Step 5: Book the appointment and LOCK the slot (prevent double-booking).
        # Re-acquire the chosen slot under a row lock (no-op on SQLite) and
        # re-verify availability so two concurrent bookings can't share it.
        locked_slot = (
            db.query(DoctorSlot)
            .filter(DoctorSlot.id == best_slot.id, DoctorSlot.is_available == True)  # noqa: E712
            .with_for_update()
            .first()
        )
        if not locked_slot:
            return {
                "is_booked": False,
                "reply": (
                    "That slot was just taken by another patient. "
                    "Please send your message again and I'll find the next best slot."
                ),
                "severity_score": severity_score,
                "collected": collected,
                "stage": "no_slots",
                "urgent_guidance": urgent_guidance,
                "guidance_type": guidance_type,
            }
        best_slot = locked_slot

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
        # Mark slot as unavailable so no one else can book it
        best_slot.is_available = False

        # Update patient's medical history (bio) with this appointment's triage assessment
        new_entry = f"\n- [{today}]: Chief complaint: {reason_text}. Severity: {severity_score}/5. Analysis: {analysis_summary}"
        if patient.medical_history:
            patient.medical_history = patient.medical_history + new_entry
        else:
            patient.medical_history = new_entry.strip()

        db.flush()
        db.refresh(appointment)

        # Step 6: Critical rescheduling — find BOOKED early slots for lower-priority patients
        created_reschedule_request_ids = []
        if severity_score >= 4:
            # FIXED: Filter is_available == False — these slots are already booked,
            # which is exactly what we want (find patients who have early appointments).
            earlier_appointments = (
                db.query(Appointment)
                .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
                .join(Doctor, DoctorSlot.doctor_id == Doctor.id)
                .filter(
                    Appointment.status == Appointment.SCHEDULED,
                    Appointment.severity_score < severity_score,
                    Appointment.reschedule_requested == False,  # noqa: E712
                    Appointment.patient_id != patient_id,
                    DoctorSlot.date <= best_slot.date,
                    Doctor.specialization.ilike(f"%{recommended_specialization}%"),
                    DoctorSlot.id != best_slot.id,
                )
                .order_by(Appointment.severity_score, DoctorSlot.date, DoctorSlot.start_time)
                .limit(3)
                .all()
            )

            for early_appt in earlier_appointments:
                reschedule_req = RescheduleRequest(
                    triggering_appointment_id=appointment.id,
                    target_appointment_id=early_appt.id,
                    proposed_slot_id=best_slot.id,
                    status=RescheduleRequest.PENDING,
                )
                db.add(reschedule_req)
                early_appt.reschedule_requested = True
                db.flush()
                db.refresh(reschedule_req)
                created_reschedule_request_ids.append(reschedule_req.id)

        db.commit()

        # Step 7: Dispatch Celery notifications AFTER commit (so IDs are stable)
        for rr_id in created_reschedule_request_ids:
            send_reschedule_notification.delay(rr_id)

        slot_info = f"{best_slot.date} at {best_slot.start_time.strftime('%I:%M %p')}"
        doctor = db.query(Doctor).filter(Doctor.id == best_slot.doctor_id).first()
        doctor_name = doctor.name if doctor else "your assigned doctor"

        # Email confirmation (after commit; failures never affect the booking)
        if patient.email:
            from clients import emailer
            emailer.appointment_confirmed(patient.email, patient.name, doctor_name, slot_info)

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
            "urgent_guidance": urgent_guidance,
            "guidance_type": guidance_type,
        }

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


@celery.task(name="send_reschedule_notification", queue="worker-queue")
def send_reschedule_notification(reschedule_request_id: int):
    """Notify a patient that they have been asked to reschedule."""
    from loguru import logger
    from database.db import connection
    from models.reschedule_request import RescheduleRequest

    db = connection()
    try:
        req = db.query(RescheduleRequest).filter(RescheduleRequest.id == reschedule_request_id).first()
        if not req:
            logger.warning(f"Reschedule request {reschedule_request_id} not found for notification.")
            return

        patient = req.target_appointment.patient
        proposed_slot = req.proposed_slot
        slot_info = f"{proposed_slot.date} at {proposed_slot.start_time.strftime('%I:%M %p')}"

        logger.info(
            f"[RESCHEDULE REQUEST] Patient {patient.name} ({patient.email}): "
            f"A critical patient needs your slot. "
            f"You are requested to move to {slot_info}. "
            f"Please accept or decline via the portal."
        )
        if patient.email:
            from clients import emailer
            emailer.reschedule_requested(patient.email, patient.name, slot_info)
    finally:
        db.close()
