import json
from datetime import date, datetime

from scheduling import is_bookable, is_locked_in, slot_start

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
            # Don't log message content - it can contain symptoms (PHI)
            logger.info(f"Local routing intercepted chat turn for patient {patient_id}")
            return local_route

        # Step 1: Intake LLM call (rolling history window to limit tokens).
        pruned_history = conversation_history[-20:] if len(conversation_history) > 20 else conversation_history

        # Keep the (large, static) system prompt byte-identical so it stays in the
        # provider's prompt cache. The per-turn collected fields ride in the latest
        # user message instead of being concatenated onto the system prompt (which
        # would bust the cache every turn and reprocess the whole reference manual).
        intake_messages = [dict(m) for m in pruned_history]
        for _m in reversed(intake_messages):
            if _m.get("role") == "user":
                _m["content"] = (
                    f"=== CURRENTLY COLLECTED FIELDS (DO NOT RE-ASK FOR THESE) ===\n"
                    f"{json.dumps(collected_fields)}\n\n"
                    f"{_m.get('content', '')}"
                )
                break

        @_llm_retry_decorator()
        def _call_intake():
            return llm_client.query_structured(
                messages=intake_messages,
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

        # Routine visits (severity 1) get no urgency banner - keyword matches
        # like "check up" against the guidance KB are noise, not advice.
        # However, if it matched a FIRST_AID action, retain it for remedy guidance.
        if severity_score <= 1 and guidance_type != "FIRST_AID":
            urgent_guidance = None
            guidance_type = None
            # Also drop the raw match so routine visits don't get urgent-care
            # text appended further down (it's keyword noise at severity 1).
            guidance_match = None

        recommended_specialization = severity_response.get("recommended_specialization", "General Medicine")
        analysis_summary = severity_response.get("analysis_summary", "")
        # Deterministic safety net: if our urgent-care KB recognizes an emergency
        # (chest pain, stroke signs, anaphylaxis, ...), force escalation even when
        # the LLM under-scores it. KB recall is regression-tested at 100% in
        # tests/test_triage_eval.py, so this guarantees known emergencies escalate.
        kb_emergency = bool(guidance_match and guidance_match.get("action") == "EMERGENCY")
        if kb_emergency:
            severity_score = max(severity_score, 5)
        is_emergency = (
            severity_response.get("is_emergency", False)
            or severity_score >= 5
            or kb_emergency
        )

        # EMERGENCY SHORT-CIRCUIT - handle this BEFORE any specialization matching
        # or booking. A 911-level case must never fall into the "we don't have that
        # specialist, want to book instead?" path just because the model named a
        # department we don't staff (e.g. "Emergency Department").
        if is_emergency:
            emergency_reply = (
                "URGENT: Based on your symptoms, you may need emergency care. "
                "Please call emergency services (911) or go to the nearest ER immediately."
            )
            if analysis_summary:
                emergency_reply += f"\n\nAnalysis: {analysis_summary}"
            if guidance_match:
                emergency_reply += f"\n\nImmediate Action:\n{guidance_match['guidance']}"
            from clients import analytics
            analytics.track("triage_emergency", patient_id, severity=severity_score)
            return {
                "is_booked": False,
                "reply": emergency_reply,
                "severity_score": severity_score,
                "stage": "emergency",
                "collected": collected,
                "urgent_guidance": urgent_guidance,
                "guidance_type": guidance_type or "EMERGENCY",
            }

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
            # We don't have this specialist - tell the patient honestly
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

        from clients import analytics
        analytics.track(
            "triage_assessed", patient_id,
            severity=severity_score,
            specialization=recommended_specialization,
            is_emergency=False,
        )

        # Step 3: Find available slots. A doctor the patient asked for BY NAME
        # outranks the specialization recommendation.
        today = date.today()
        now = datetime.now()
        preferred_note = ""
        available_slots = []

        preferred_name_raw = str(collected.get("preferred_doctor") or "").strip()
        if preferred_name_raw:
            cleaned = preferred_name_raw.lower()
            for prefix in ("dr.", "dr ", "doctor "):
                if cleaned.startswith(prefix):
                    cleaned = cleaned[len(prefix):].strip()
            cleaned = cleaned.strip(". ")
            preferred_doctor = (
                db.query(Doctor)
                .filter(
                    Doctor.name.ilike(f"%{cleaned}%"),
                    Doctor.availability_status == Doctor.AVAILABLE,
                    Doctor.application_status == Doctor.APPROVED,
                )
                .first()
            ) if cleaned else None

            if preferred_doctor:
                available_slots = (
                    db.query(DoctorSlot)
                    .filter(
                        DoctorSlot.is_available == True,  # noqa: E712
                        DoctorSlot.date >= today,
                        DoctorSlot.doctor_id == preferred_doctor.id,
                    )
                    .order_by(DoctorSlot.date, DoctorSlot.start_time)
                    .all()
                )
                if available_slots:
                    # Book the doctor they asked for; reflect their specialty
                    recommended_specialization = preferred_doctor.specialization
                else:
                    preferred_note = (
                        f"{preferred_doctor.name} has no open slots right now, so I matched you "
                        f"with the best available {recommended_specialization} doctor instead.\n\n"
                    )
            else:
                preferred_note = (
                    f'I couldn\'t find an available doctor named "{preferred_name_raw}", so I matched '
                    f"you with the best available {recommended_specialization} doctor instead.\n\n"
                )

        if not available_slots:
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
            no_slots_reply = (
                f"I've assessed your condition (severity: {severity_score}/5). "
                f"Unfortunately, no {recommended_specialization} slots are available right now. "
                f"Please call the hospital directly for urgent care."
            )
            if guidance_match:
                no_slots_reply += f"\n\nRecommended care while you wait:\n{guidance_match['guidance']}"
            return {
                "is_booked": False,
                "reply": no_slots_reply,
                "severity_score": severity_score,
                "stage": "no_slots",
                "urgent_guidance": urgent_guidance,
                "guidance_type": guidance_type,
            }

        # Step 4: Select the earliest slot the patient can realistically reach.
        # available_slots is already ordered date/time ascending; skip any slot
        # that has started or passed its booking cutoff (closes_before_minutes),
        # so we never book a time that has effectively already gone by.
        best_slot = next((s for s in available_slots if is_bookable(s, now)), None)
        if not best_slot:
            no_slots_reply = (
                f"I've assessed your condition (severity: {severity_score}/5). "
                f"The remaining {recommended_specialization} slots have already passed their "
                f"booking window. Please call the hospital directly for the soonest opening."
            )
            if guidance_match:
                no_slots_reply += f"\n\nRecommended care while you wait:\n{guidance_match['guidance']}"
            return {
                "is_booked": False,
                "reply": no_slots_reply,
                "severity_score": severity_score,
                "collected": collected,
                "stage": "no_slots",
                "urgent_guidance": urgent_guidance,
                "guidance_type": guidance_type,
            }

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

        # The doctor-facing AI prep briefing and no-show prediction are two extra
        # LLM calls the PATIENT never sees in their reply - so we DON'T block the
        # booking response on them. Store a cheap heuristic now and refine them
        # asynchronously (enrich_appointment_ai) right after commit.
        no_show_probability = 0.15
        no_show_risk_reason = (
            "Low risk - acute/severe symptom profile." if severity_score >= 3
            else "Routine checkup with standard baseline risk."
        )

        appointment = Appointment(
            patient_id=patient_id,
            doctor_id=best_slot.doctor_id,
            slot_id=best_slot.id,
            reason=reason_text,
            severity_score=severity_score,
            status=Appointment.SCHEDULED,
            clinical_summary=None,
            no_show_probability=no_show_probability,
            no_show_risk_reason=no_show_risk_reason,
            conversation_history=json.dumps(conversation_history),
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

        # Step 6: Severity swap - offer this critical patient an EARLIER slot held
        # by a lower-priority patient. Two hard rules:
        #   • "Earlier" is by full date+time, not date alone, so we never move the
        #     critical patient to a LATER time on the same day.
        #   • We never bump a patient whose appointment is inside the travel/lock
        #     window - they may already be on their way (scheduling.is_locked_in).
        created_reschedule_request_ids = []
        if severity_score >= 4:
            best_start = slot_start(best_slot)
            candidate_pool = (
                db.query(Appointment)
                .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
                .join(Doctor, DoctorSlot.doctor_id == Doctor.id)
                .join(Patient, Appointment.patient_id == Patient.id)
                .filter(
                    Appointment.status == Appointment.SCHEDULED,
                    Appointment.severity_score < severity_score,
                    Appointment.reschedule_requested == False,  # noqa: E712
                    Appointment.patient_id != patient_id,
                    Patient.allow_severity_swap == True,  # noqa: E712  consent required
                    DoctorSlot.date >= today,
                    DoctorSlot.date <= best_slot.date,
                    Doctor.specialization.ilike(f"%{recommended_specialization}%"),
                    DoctorSlot.id != best_slot.id,
                )
                .order_by(Appointment.severity_score, DoctorSlot.date, DoctorSlot.start_time)
                .all()
            )

            earlier_appointments = [
                a for a in candidate_pool
                if a.slot
                and slot_start(a.slot) < best_start       # genuinely earlier in time
                and not is_locked_in(a.slot, now)         # not already travelling
            ][:3]

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

        # Doctor-facing AI enrichment runs off the patient's response path.
        _dispatch_appointment_enrichment(appointment.id)

        analytics.track(
            "booking_created", patient_id,
            severity=severity_score, specialization=recommended_specialization,
        )

        # Step 7: Dispatch Celery notifications AFTER commit (so IDs are stable)
        for rr_id in created_reschedule_request_ids:
            send_reschedule_notification.delay(rr_id)

        slot_info = f"{best_slot.date} at {best_slot.start_time.strftime('%I:%M %p')}"
        doctor = db.query(Doctor).filter(Doctor.id == best_slot.doctor_id).first()
        doctor_name = doctor.name if doctor else "your assigned doctor"

        # Email + push confirmation (after commit; failures never affect the booking)
        if patient.email:
            from clients import emailer
            emailer.appointment_confirmed(patient.email, patient.name, doctor_name, slot_info)
        from clients import push
        push.notify_subject(
            db, patient.id, "patient",
            "Appointment confirmed",
            f"{doctor_name} - {slot_info}",
            {"screen": "Visits"},
        )

        reply = (
            f"{preferred_note}"
            f"Your appointment has been booked!\n\n"
            f"- Doctor: {doctor_name} ({recommended_specialization})\n"
            f"- Date & Time: {slot_info}\n"
            f"- Severity Assessment: {severity_score}/5 - {analysis_summary}\n\n"
        )
        if guidance_match:
            reply += f"Recommended care before your visit:\n{guidance_match['guidance']}\n\n"
        reply += f"Please arrive 10 minutes early. Take care!"

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


def _dispatch_appointment_enrichment(appointment_id: int) -> None:
    """Kick off doctor-facing AI enrichment without blocking the patient's reply.

    Prefer the Celery worker. In tests (no broker) or when the broker is down
    (dev inline mode), fall back to running it synchronously so the data still
    gets generated - the patient has already received their confirmation by then.
    """
    import os
    from loguru import logger

    if os.environ.get("TESTING") == "True":
        try:
            enrich_appointment_ai(appointment_id)
        except Exception:
            pass
        return

    try:
        enrich_appointment_ai.delay(appointment_id)
    except Exception as exc:
        logger.warning(f"Enrichment dispatch failed ({exc}); running inline.")
        try:
            enrich_appointment_ai(appointment_id)
        except Exception:
            pass


@celery.task(name="enrich_appointment_ai", queue="worker-queue")
def enrich_appointment_ai(appointment_id: int):
    """Generate the doctor-facing prep briefing + no-show prediction for a booked
    appointment. These are two LLM calls the patient never sees, so they run here
    - off the booking response path - and update the appointment row in place."""
    from loguru import logger
    from clients import llm_client
    from clients.prompts import PREP_BRIEFING_SYSTEM_PROMPT, NO_SHOW_PREDICTION_SYSTEM_PROMPT
    from database.db import connection
    from models.appointment import Appointment

    db = connection()
    try:
        appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appt:
            return
        patient = appt.patient

        # 1) Clinical prep briefing
        try:
            if appt.conversation_history:
                history_list = json.loads(appt.conversation_history)
                convo_text = "\n".join(
                    f"{'Patient' if m.get('role') == 'user' else 'AI'}: {m.get('content')}"
                    for m in history_list
                )
            else:
                convo_text = f"Patient presents with chief complaint: {appt.reason or 'Not specified'}."
            prompt_input = (
                f"Conversation History:\n{convo_text}\n\n"
                f"Chief Complaint: {appt.reason or 'Not specified'}\n"
                f"Severity Score: {appt.severity_score}/5\n"
            )
            ai_briefing = llm_client.query(prompt_input, system_prompt=PREP_BRIEFING_SYSTEM_PROMPT)
            if ai_briefing and "not configured" not in ai_briefing:
                appt.clinical_summary = ai_briefing.strip()
        except Exception as exc:
            logger.warning(f"Prep briefing generation failed for appt {appointment_id}: {exc}")

        # 2) No-show / cancellation risk
        try:
            prev = (
                db.query(Appointment)
                .filter(Appointment.patient_id == appt.patient_id, Appointment.id != appt.id)
                .all()
            )
            total_past = len(prev)
            past_no_shows = sum(1 for a in prev if a.status == Appointment.NO_SHOW)
            past_cancellations = sum(1 for a in prev if a.status == Appointment.CANCELLED)
            prompt_input = (
                f"Symptom/Reason: {appt.reason or 'Not specified'}\n"
                f"Severity Score: {appt.severity_score}/5\n"
                f"Appointment Time: {appt.slot.start_time.strftime('%I:%M %p')} on {appt.slot.date.strftime('%A')}\n"
                f"Patient Medical History: {(patient.medical_history if patient else None) or 'None'}\n"
                f"Historical Attendance: {total_past} total bookings, {past_no_shows} no-shows, {past_cancellations} cancellations.\n"
            )
            res = llm_client.query_structured(
                messages=[{"role": "user", "content": prompt_input}],
                system_prompt=NO_SHOW_PREDICTION_SYSTEM_PROMPT,
            )
            if res and isinstance(res, dict) and "error" not in res:
                appt.no_show_probability = res.get("no_show_probability", appt.no_show_probability)
                appt.no_show_risk_reason = res.get("no_show_risk_reason", appt.no_show_risk_reason)
        except Exception as exc:
            logger.warning(f"No-show prediction failed for appt {appointment_id}: {exc}")

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Appointment enrichment failed for {appointment_id}: {exc}")
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

        # Log by id, not name/email (PII)
        logger.info(
            f"[RESCHEDULE REQUEST] Notifying patient {patient.id} (request {req.id}): "
            f"move requested to {slot_info}."
        )
        if patient.email:
            from clients import emailer
            emailer.reschedule_requested(patient.email, patient.name, slot_info)
        from clients import push
        push.notify_subject(
            db, patient.id, "patient",
            "A critical patient needs your slot",
            f"You're asked to move to {slot_info}. Open CuraLine to accept or decline.",
            {"screen": "Reschedule"},
        )
    finally:
        db.close()


@celery.task(name="optimize_queue_for_free_slot", queue="worker-queue")
def optimize_queue_for_free_slot(slot_id: int):
    """
    Scans for patients booked in the future with high severity (severity >= 3)
    and offers them this newly freed slot_id to optimize the doctor's queue.
    """
    from loguru import logger
    from database.db import connection
    from models.doctor_slot import DoctorSlot
    from models.doctor import Doctor
    from models.appointment import Appointment
    from models.reschedule_request import RescheduleRequest

    db = connection()
    try:
        slot = db.query(DoctorSlot).filter(DoctorSlot.id == slot_id).first()
        if not slot or not slot.is_available:
            logger.info(f"[QUEUE OPTIMIZATION] Slot {slot_id} is not available or not found.")
            return
        
        doctor = db.query(Doctor).filter(Doctor.id == slot.doctor_id).first()
        if not doctor:
            logger.warning(f"[QUEUE OPTIMIZATION] Doctor for slot {slot_id} not found.")
            return

        # The freed slot can only help someone who can actually get to it - if it
        # starts inside the travel/lock window there's no point offering it.
        now = datetime.now()
        if is_locked_in(slot, now):
            logger.info(f"[QUEUE OPTIMIZATION] Slot {slot_id} is too soon to reassign; skipping.")
            return

        freed_start = slot_start(slot)

        # Future scheduled high-severity patients for this specialization who are
        # currently LATER than the freed slot (by full date+time), most urgent first.
        # No consent gate here: this OFFERS a high-severity patient an earlier
        # freed slot (a beneficial upgrade), it never takes anyone's slot away.
        candidate_pool = (
            db.query(Appointment)
            .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
            .join(Doctor, DoctorSlot.doctor_id == Doctor.id)
            .filter(
                Appointment.status == Appointment.SCHEDULED,
                Appointment.severity_score >= 3,
                Appointment.reschedule_requested == False,  # noqa: E712
                DoctorSlot.date >= slot.date,
                Doctor.specialization.ilike(f"%{doctor.specialization}%"),
            )
            .order_by(Appointment.severity_score.desc(), DoctorSlot.date.asc(), DoctorSlot.start_time.asc())
            .all()
        )
        better_candidate_appt = next(
            (a for a in candidate_pool if a.slot and slot_start(a.slot) > freed_start),
            None,
        )

        if better_candidate_appt:
            # Create a direct upgrade reschedule request where triggering and target appointments are the same
            reschedule_req = RescheduleRequest(
                triggering_appointment_id=better_candidate_appt.id,
                target_appointment_id=better_candidate_appt.id,
                proposed_slot_id=slot.id,
                status=RescheduleRequest.PENDING,
            )
            db.add(reschedule_req)
            better_candidate_appt.reschedule_requested = True
            
            # Temporarily reserve the slot for this patient
            slot.is_available = False
            
            db.flush()
            db.commit()

            # Notify the patient
            send_reschedule_notification.delay(reschedule_req.id)
            logger.info(
                f"[QUEUE OPTIMIZATION] Created direct upgrade reschedule request {reschedule_req.id} "
                f"for patient {better_candidate_appt.patient_id} into freed slot {slot_id}."
            )
        else:
            logger.info(f"[QUEUE OPTIMIZATION] No high-severity candidates found to fill slot {slot_id}.")
    except Exception as exc:
        db.rollback()
        logger.error(f"[QUEUE OPTIMIZATION] Error optimizing queue for freed slot {slot_id}: {exc}")
    finally:
        db.close()


@celery.task(name="auto_resolve_past_appointments", queue="worker-queue")
def auto_resolve_past_appointments():
    """
    Finds past scheduled appointments that have passed their slot date,
    and updates their status to NO_SHOW.
    """
    from loguru import logger
    from database.db import connection
    from models.appointment import Appointment
    from models.doctor_slot import DoctorSlot
    from datetime import date

    db = connection()
    try:
        today = date.today()
        past_scheduled = (
            db.query(Appointment)
            .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
            .filter(
                Appointment.status == Appointment.SCHEDULED,
                DoctorSlot.date < today
            )
            .all()
        )
        if not past_scheduled:
            logger.info("[AUTO RESOLVE] No past scheduled appointments to resolve.")
            return

        count = 0
        for appt in past_scheduled:
            appt.status = Appointment.NO_SHOW
            count += 1
        
        db.commit()
        logger.info(f"[AUTO RESOLVE] Auto-resolved {count} past scheduled appointments to NO_SHOW.")
    except Exception as exc:
        db.rollback()
        logger.error(f"[AUTO RESOLVE] Error resolving past scheduled appointments: {exc}")
    finally:
        db.close()

