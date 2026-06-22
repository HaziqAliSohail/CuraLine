import os
import sys
from datetime import date, time, timedelta

# Adjust Python path to load database models
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from database.db import connection
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from models.patient import Patient
from models.appointment import Appointment
from models.reschedule_request import RescheduleRequest
from web.auth.security import hash_password

def setup_simulation():
    session = connection()
    try:
        # 1. Clean up existing simulation data if run multiple times
        old_jane = session.query(Patient).filter(Patient.email == "jane@example.com").first()
        if old_jane:
            session.query(RescheduleRequest).filter(
                (RescheduleRequest.target_appointment_id.in_(
                    session.query(Appointment.id).filter(Appointment.patient_id == old_jane.id)
                )) |
                (RescheduleRequest.triggering_appointment_id.in_(
                    session.query(Appointment.id).filter(Appointment.patient_id == old_jane.id)
                ))
            ).delete(synchronize_session=False)
            session.query(Appointment).filter(Appointment.patient_id == old_jane.id).delete()
            session.delete(old_jane)
            session.commit()

        # 2. Get the cardiology doctor (Dr. Sarah Jenkins)
        doctor = session.query(Doctor).filter(Doctor.email == "sarah.jenkins@curaline.com").first()
        if not doctor:
            print("Dr. Sarah Jenkins not found. Please run backend seed first.")
            return

        # 3. Create or find target patient Jane (low priority patient)
        jane = Patient(
            name="Jane Doe",
            gender="FEMALE",
            phone="+15559002",
            email="jane@example.com",
            password_hash=hash_password("Patient@1234"),
            medical_history="Routine follow-up.",
            is_admin=False,
        )
        session.add(jane)
        session.flush()

        # 4. Find the main demo patient John Carter (critical patient)
        john = session.query(Patient).filter(Patient.email == "john@example.com").first()
        if not john:
            john = Patient(
                name="John Carter",
                gender="MALE",
                phone="+15559001",
                email="john@example.com",
                password_hash=hash_password("Patient@1234"),
                medical_history="Mild hypertension.",
                is_admin=False,
            )
            session.add(john)
            session.flush()

        # 5. Create slots for Dr. Sarah Jenkins (e.g. tomorrow)
        tomorrow = date.today() + timedelta(days=1)
        
        # Jane's early slot (e.g., 9:00 AM)
        jane_slot = session.query(DoctorSlot).filter(
            DoctorSlot.doctor_id == doctor.id,
            DoctorSlot.date == tomorrow,
            DoctorSlot.start_time == time(9, 0)
        ).first()
        if not jane_slot:
            jane_slot = DoctorSlot(
                doctor_id=doctor.id,
                date=tomorrow,
                start_time=time(9, 0),
                duration_minutes=30,
                is_available=False
            )
            session.add(jane_slot)
        else:
            jane_slot.is_available = False
        session.flush()

        # John's slot (proposed replacement slot at 2:00 PM)
        proposed_slot = session.query(DoctorSlot).filter(
            DoctorSlot.doctor_id == doctor.id,
            DoctorSlot.date == tomorrow,
            DoctorSlot.start_time == time(14, 0)
        ).first()
        if not proposed_slot:
            proposed_slot = DoctorSlot(
                doctor_id=doctor.id,
                date=tomorrow,
                start_time=time(14, 0),
                duration_minutes=30,
                is_available=False
            )
            session.add(proposed_slot)
        else:
            proposed_slot.is_available = False
        session.flush()

        # 6. Create early appointment for Jane (severity 1, asked to reschedule)
        jane_appt = Appointment(
            patient_id=jane.id,
            doctor_id=doctor.id,
            slot_id=jane_slot.id,
            status=Appointment.SCHEDULED,
            reason="Routine checkup",
            severity_score=1,
            reschedule_requested=True
        )
        session.add(jane_appt)
        session.flush()

        # 7. Create critical appointment for John (severity 5, occupying the later slot)
        john_appt = Appointment(
            patient_id=john.id,
            doctor_id=doctor.id,
            slot_id=proposed_slot.id,
            status=Appointment.SCHEDULED,
            reason="Severe chest pain and dyspnea",
            severity_score=5,
            reschedule_requested=False
        )
        session.add(john_appt)
        session.flush()

        # 8. Create Reschedule Request: Propose Jane move to John's proposed slot (14:00)
        # to clear Jane's 9:00 AM slot for critical John
        resch_req = RescheduleRequest(
            triggering_appointment_id=john_appt.id,
            target_appointment_id=jane_appt.id,
            proposed_slot_id=proposed_slot.id,
            status=RescheduleRequest.PENDING
        )
        session.add(resch_req)
        session.commit()

        print("\n✅ Reschedule simulation state created successfully!")
        print("------------------------------------------------------------")
        print(f"Target Patient (Asked to swap): jane@example.com / Patient@1234")
        print(f"  Current Slot: Tomorrow at 09:00 AM (with {doctor.name})")
        print(f"  Proposed Slot: Tomorrow at 02:00 PM (with {doctor.name})")
        print(f"Triggering Patient (Critical): john@example.com")
        print("------------------------------------------------------------")
        print("👉 How to test in the Mobile App / Web Portal:")
        print("1. Log in to the app/web using the target patient:")
        print("   Email:    jane@example.com")
        print("   Password: Patient@1234")
        print("2. Navigate to the 'Reschedule' tab.")
        print("3. You should see a card prompting Jane to swap her 9:00 AM appointment to 2:00 PM.")
        print("4. Tap 'Accept' or 'Decline' and verify the visits updates!")

    except Exception as e:
        session.rollback()
        print(f"❌ Error during setup: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    setup_simulation()
