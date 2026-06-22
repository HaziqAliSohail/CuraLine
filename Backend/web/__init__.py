from fastapi import APIRouter

from .inference.inference import inference_router
from .auth.router import auth_router
from .doctors.router import doctors_router
from .slots.router import slots_router
from .patients.router import patients_router
from .appointments.router import appointments_router
from .reschedule.router import reschedule_router
from .doctor_portal.router import doctor_portal_router
from .reviews.router import reviews_router
from .hospitals.router import hospitals_router
from .notifications.router import notifications_router
from .insurance.router import insurance_router
from .consent.router import consent_router
from .video.router import video_router
from .admin.router import admin_router
from .payments.router import payments_router
from .fhir.router import fhir_router

web_router = APIRouter()

web_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
web_router.include_router(inference_router, prefix="/inference", tags=["AI Booking"])
web_router.include_router(doctors_router, prefix="/doctors", tags=["Doctors"])
web_router.include_router(slots_router, prefix="/slots", tags=["Doctor Slots"])
web_router.include_router(patients_router, prefix="/patients", tags=["Patients"])
web_router.include_router(appointments_router, prefix="/appointments", tags=["Appointments"])
web_router.include_router(reschedule_router, prefix="/reschedule", tags=["Reschedule"])
web_router.include_router(doctor_portal_router, prefix="/doctor", tags=["Doctor Portal"])
web_router.include_router(reviews_router, prefix="/reviews", tags=["Reviews"])
web_router.include_router(hospitals_router, prefix="/hospitals", tags=["Hospitals"])
web_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
web_router.include_router(insurance_router, prefix="/insurance", tags=["Insurance"])
web_router.include_router(consent_router, prefix="/consent", tags=["Consent"])
web_router.include_router(video_router, prefix="/telehealth", tags=["Telehealth"])
web_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
web_router.include_router(payments_router, prefix="/payments", tags=["Payments"])
web_router.include_router(fhir_router, prefix="/fhir", tags=["FHIR"])
