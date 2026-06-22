from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from models.hospital import Hospital
from models.patient import Patient
from web.auth.permissions import require_admin

hospitals_router = APIRouter()


import math

def haversine(lat1, lon1, lat2, lon2):
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    r = 3958.8  # radius of Earth in miles
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


class HospitalInSchema(BaseModel):
    name: str = Field(..., max_length=100)
    address: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=15)
    latitude: float | None = None
    longitude: float | None = None


class HospitalOutSchema(BaseModel):
    id: int
    name: str
    address: str | None
    phone: str | None
    latitude: float | None = None
    longitude: float | None = None
    doctor_count: int = 0

    model_config = {"from_attributes": True}


class NearbyHospitalOutSchema(BaseModel):
    id: int
    name: str
    address: str | None
    phone: str | None
    latitude: float | None = None
    longitude: float | None = None
    doctor_count: int = 0
    distance: float | None = None

    model_config = {"from_attributes": True}


@hospitals_router.get("/", response_model=list[HospitalOutSchema])
def list_hospitals(db: Session = Depends(get_db_session)):
    # Only platform-verified hospitals are publicly visible.
    hospitals = (
        db.query(Hospital)
        .filter(Hospital.verification_status == Hospital.VERIFIED)
        .order_by(Hospital.name)
        .all()
    )
    out = []
    for h in hospitals:
        count = db.query(Doctor).filter(
            Doctor.hospital_id == h.id,
            Doctor.application_status == Doctor.APPROVED,
        ).count()
        out.append({
            "id": h.id, "name": h.name, "address": h.address,
            "phone": h.phone, "latitude": h.latitude, "longitude": h.longitude,
            "doctor_count": count,
        })
    return out


@hospitals_router.get("/nearby", response_model=list[NearbyHospitalOutSchema])
def list_nearby_hospitals(
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db_session),
):
    hospitals = db.query(Hospital).filter(
        Hospital.verification_status == Hospital.VERIFIED
    ).all()
    out = []
    for h in hospitals:
        count = db.query(Doctor).filter(
            Doctor.hospital_id == h.id,
            Doctor.application_status == Doctor.APPROVED,
        ).count()
        dist = haversine(latitude, longitude, h.latitude, h.longitude)
        out.append({
            "id": h.id, "name": h.name, "address": h.address,
            "phone": h.phone, "latitude": h.latitude, "longitude": h.longitude,
            "doctor_count": count,
            "distance": round(dist, 2) if dist is not None else None,
        })
    # Sort by distance (closest first, None/nulls at the end)
    out.sort(key=lambda x: x["distance"] if x["distance"] is not None else float('inf'))
    return out


@hospitals_router.post("/", response_model=HospitalOutSchema, status_code=status.HTTP_201_CREATED)
def create_hospital(
    body: HospitalInSchema,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    hospital = Hospital(**body.model_dump())
    db.add(hospital)
    db.flush()
    db.refresh(hospital)
    return {
        "id": hospital.id, "name": hospital.name, "address": hospital.address,
        "phone": hospital.phone, "latitude": hospital.latitude, "longitude": hospital.longitude,
        "doctor_count": 0,
    }


@hospitals_router.put("/{hospital_id}/assign/{doctor_id}", response_model=HospitalOutSchema)
def assign_doctor_to_hospital(
    hospital_id: int,
    doctor_id: int,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found.")
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    doctor.hospital_id = hospital.id
    db.flush()
    count = db.query(Doctor).filter(
        Doctor.hospital_id == hospital.id,
        Doctor.application_status == Doctor.APPROVED,
    ).count()
    return {
        "id": hospital.id, "name": hospital.name, "address": hospital.address,
        "phone": hospital.phone, "doctor_count": count,
    }
