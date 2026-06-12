from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.appointment import Appointment
from models.doctor import Doctor
from models.patient import Patient
from models.review import Review
from web.auth.security import get_current_patient
from web.reviews.schemas import (
    DoctorReviewsOutSchema,
    MyReviewOutSchema,
    ReviewCreateSchema,
    ReviewOutSchema,
)

reviews_router = APIRouter()


def _display_name(full_name: str | None) -> str:
    """Abbreviate for privacy: 'John Carter' → 'John C.'"""
    if not full_name or not full_name.strip():
        return "Verified Patient"
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


def _recompute_doctor_rating(db: Session, doctor_id: int) -> None:
    """Doctor.rating becomes the rounded average of verified reviews."""
    ratings = [r.rating for r in db.query(Review).filter(Review.doctor_id == doctor_id)]
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if doctor and ratings:
        doctor.rating = round(sum(ratings) / len(ratings))


@reviews_router.post("/", response_model=MyReviewOutSchema, status_code=status.HTTP_201_CREATED)
def create_review(
    body: ReviewCreateSchema,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Leave a review for a visit you attended. Gated on the doctor having
    marked the appointment COMPLETED — this is what makes reviews verified."""
    appt = db.query(Appointment).filter(
        Appointment.id == body.appointment_id,
        Appointment.patient_id == current_patient.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appt.status != Appointment.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You can only review visits your doctor has marked as completed.",
        )
    existing = db.query(Review).filter(Review.appointment_id == appt.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this visit.",
        )

    review = Review(
        appointment_id=appt.id,
        patient_id=current_patient.id,
        doctor_id=appt.doctor_id,
        rating=body.rating,
        comment=(body.comment or "").strip() or None,
    )
    db.add(review)
    db.flush()
    _recompute_doctor_rating(db, appt.doctor_id)
    db.flush()
    db.refresh(review)
    return review


@reviews_router.get("/mine", response_model=list[MyReviewOutSchema])
def list_my_reviews(
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    return (
        db.query(Review)
        .filter(Review.patient_id == current_patient.id)
        .order_by(Review.id.desc())
        .all()
    )


@reviews_router.get("/doctor/{doctor_id}", response_model=DoctorReviewsOutSchema)
def list_doctor_reviews(doctor_id: int, db: Session = Depends(get_db_session)):
    """Public: verified reviews for an approved doctor, newest first."""
    doctor = db.query(Doctor).filter(
        Doctor.id == doctor_id,
        Doctor.application_status == Doctor.APPROVED,
    ).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    reviews = (
        db.query(Review)
        .filter(Review.doctor_id == doctor_id)
        .order_by(Review.id.desc())
        .limit(50)
        .all()
    )
    ratings = [r.rating for r in db.query(Review).filter(Review.doctor_id == doctor_id)]
    average = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

    return {
        "doctor_id": doctor_id,
        "average_rating": average,
        "review_count": len(ratings),
        "reviews": [
            ReviewOutSchema(
                id=r.id,
                rating=r.rating,
                comment=r.comment,
                patient_display_name=_display_name(r.patient.name if r.patient else None),
                created_at=r.created_at,
            )
            for r in reviews
        ],
    }
