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
        # Force clear existing tables to allow fresh re-seeding.
        # Delete in FK-dependency order: children (which reference appointments/
        # doctors/patients) before parents, or Postgres rejects the deletes.
        from models.appointment import Appointment
        from models.reschedule_request import RescheduleRequest
        from models.review import Review
        from models.hospital import Hospital
        from models.platform_admin import PlatformAdmin
        session.query(Review).delete()
        session.query(RescheduleRequest).delete()
        session.query(Appointment).delete()
        session.query(DoctorSlot).delete()
        session.query(Doctor).delete()
        session.query(Hospital).delete()
        session.query(Patient).delete()
        # Platform operators are seeded below; clear so reseed is idempotent
        # (unique email would otherwise collide on a second run).
        session.query(PlatformAdmin).delete()
        session.commit()

        print("Seeding hospitals...")
        from models.hospital import Hospital
        h1 = Hospital(
            name="CuraLine General Hospital",
            address="711 7th Ave, New York, NY 10036",
            phone="+12125550100",
            latitude=40.7590,
            longitude=-73.9845,
        )
        h2 = Hospital(
            name="Springfield Neurology Clinic",
            address="220 W 19th St, New York, NY 10011",
            phone="+12125550102",
            latitude=40.7420,
            longitude=-74.0005,
        )
        h3 = Hospital(
            name="Westside Urgent Care",
            address="521 Columbus Ave, New York, NY 10024",
            phone="+12125550103",
            latitude=40.7850,
            longitude=-73.9745,
        )
        h4 = Hospital(
            name="Bayview Health Center",
            address="135 N 7th St, Brooklyn, NY 11249",
            phone="+17185550104",
            latitude=40.7180,
            longitude=-73.9575,
        )
        session.add_all([h1, h2, h3, h4])
        session.flush()

        print("Seeding doctors...")
        doctors_data = [
            (dict(name="Dr. Sarah Jenkins", gender="FEMALE", phone="+15550101",
                 email="sarah.jenkins@curaline.com", specialization="Cardiology",
                 qualification="MD, FACC", availability_status="AVAILABLE",
                 consultation_fee=150.00, reporting_time=time(9, 0),
                 leaving_time=time(17, 0), rating=5,
                 accepted_insurance_plans=json.dumps(
                     ["Blue Cross Blue Shield", "Aetna", "UnitedHealthcare", "Medicare"])), h1.id),
            (dict(name="Dr. James Patel", gender="MALE", phone="+15550102",
                 email="james.patel@curaline.com", specialization="Neurology",
                 qualification="MD, DM Neurology", availability_status="AVAILABLE",
                 consultation_fee=200.00, reporting_time=time(8, 0),
                 leaving_time=time(16, 0), rating=5,
                 accepted_insurance_plans=json.dumps(
                     ["Blue Cross Blue Shield", "Cigna", "Humana", "Medicare"])), h2.id),
            (dict(name="Dr. Aisha Rahman", gender="FEMALE", phone="+15550103",
                 email="aisha.rahman@curaline.com", specialization="Orthopedics",
                 qualification="MS Ortho", availability_status="AVAILABLE",
                 consultation_fee=175.00, reporting_time=time(10, 0),
                 leaving_time=time(18, 0), rating=4,
                 accepted_insurance_plans=json.dumps(
                     ["Aetna", "Cigna", "UnitedHealthcare"])), h3.id),
            (dict(name="Dr. Carlos Reyes", gender="MALE", phone="+15550104",
                 email="carlos.reyes@curaline.com", specialization="General Medicine",
                 qualification="MBBS, MD", availability_status="AVAILABLE",
                 consultation_fee=100.00, reporting_time=time(9, 0),
                 leaving_time=time(17, 0), rating=4,
                 accepted_insurance_plans=json.dumps(
                     ["Blue Cross Blue Shield", "Aetna", "Cigna", "UnitedHealthcare",
                      "Humana", "Medicare", "Medicaid", "Self-Pay / Uninsured"])), h4.id),
        ]

        doctors = []
        for data, hosp_id in doctors_data:
            doc = Doctor(**data, password_hash=hash_password("Doctor@1234"), hospital_id=hosp_id)
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

        print("Seeding platform operator...")
        # Platform operator - a first-class identity, separate from patients.
        from models.platform_admin import PlatformAdmin
        admin = PlatformAdmin(
            name="Platform Admin",
            email="admin@curaline.com",
            password_hash=hash_password("Admin@1234"),
        )
        session.add(admin)

        print("Seeding sample patients...")
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
