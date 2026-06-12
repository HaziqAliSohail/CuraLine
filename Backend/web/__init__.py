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
