from datetime import date, time, timedelta
import json
from database.db import connection, Base, engine
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from models.patient import Patient
from web.auth.security import hash_password


def seed():
    # Create tables if they don't exist (useful for local SQLite dev)
    Base.metadata.create_all(bind=engine)

    session = connection()
    try:
        # Skip if doctors already exist
        if session.query(Doctor).count() > 0:
            print("Database already seeded, skipping.")
            return

        print("Seeding doctors...")
        doctors_data = [
            dict(name="Dr. Sarah Jenkins", gender="FEMALE", phone="+15550101",
                 email="sarah.jenkins@curaline.com", specialization="Cardiology",
                 qualification="MD, FACC", availability_status="AVAILABLE",
                 consultation_fee=150.00, reporting_time=time(9, 0),
                 leaving_time=time(17, 0), rating=5,
                 accepted_insurance_plans=json.dumps(
                     ["Blue Cross Blue Shield", "Aetna", "UnitedHealthcare", "Medicare"])),
            dict(name="Dr. James Patel", gender="MALE", phone="+15550102",
                 email="james.patel@curaline.com", specialization="Neurology",
                 qualification="MD, DM Neurology", availability_status="AVAILABLE",
                 consultation_fee=200.00, reporting_time=time(8, 0),
                 leaving_time=time(16, 0), rating=5,
                 accepted_insurance_plans=json.dumps(
                     ["Blue Cross Blue Shield", "Cigna", "Humana", "Medicare"])),
            dict(name="Dr. Aisha Rahman", gender="FEMALE", phone="+15550103",
                 email="aisha.rahman@curaline.com", specialization="Orthopedics",
                 qualification="MS Ortho", availability_status="AVAILABLE",
                 consultation_fee=175.00, reporting_time=time(10, 0),
                 leaving_time=time(18, 0), rating=4,
                 accepted_insurance_plans=json.dumps(
                     ["Aetna", "Cigna", "UnitedHealthcare"])),
            dict(name="Dr. Carlos Reyes", gender="MALE", phone="+15550104",
                 email="carlos.reyes@curaline.com", specialization="General Medicine",
                 qualification="MBBS, MD", availability_status="AVAILABLE",
                 consultation_fee=100.00, reporting_time=time(9, 0),
                 leaving_time=time(17, 0), rating=4,
                 accepted_insurance_plans=json.dumps(
                     ["Blue Cross Blue Shield", "Aetna", "Cigna", "UnitedHealthcare",
                      "Humana", "Medicare", "Medicaid", "Self-Pay / Uninsured"])),
        ]

        doctors = []
        for data in doctors_data:
            doc = Doctor(**data, password_hash=hash_password("Doctor@1234"))
            session.add(doc)
            session.flush()
            doctors.append(doc)

        print("Seeding slots (7 days × 4 doctors × 3 time slots)...")
        slot_times = [time(9, 0), time(11, 0), time(14, 0)]
        for day_offset in range(1, 8):
            slot_date = date.today() + timedelta(days=day_offset)
            for doc in doctors:
                for slot_time in slot_times:
                    slot = DoctorSlot(
                        doctor_id=doc.id,
                        date=slot_date,
                        start_time=slot_time,
                        duration_minutes=30,
                        closes_before_minutes=15,
                        is_available=True,
                    )
                    session.add(slot)

        print("Seeding sample patients...")
        # Admin patient for managing doctors/slots
        admin = Patient(
            name="Admin User",
            gender="MALE",
            phone="+15559000",
            email="admin@curaline.com",
            password_hash=hash_password("Admin@1234"),
            medical_history=None,
            is_admin=True,
        )
        session.add(admin)

        # Demo patient
        demo = Patient(
            name="John Carter",
            gender="MALE",
            phone="+15559001",
            email="john@example.com",
            password_hash=hash_password("Patient@1234"),
            medical_history="Mild hypertension. Takes lisinopril 10mg daily.",
            is_admin=False,
        )
        session.add(demo)

        session.commit()
        print("\n✅ Database seeded successfully!")
        print("  Admin login:   admin@curaline.com / Admin@1234")
        print("  Patient login: john@example.com  / Patient@1234")
        print("  Doctor login:  sarah.jenkins@curaline.com / Doctor@1234 (portal)")

    except Exception as e:
        session.rollback()
        print(f"❌ Error during seeding: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
