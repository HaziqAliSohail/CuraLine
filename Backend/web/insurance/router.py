from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from models.patient import Patient
from web.auth.security import get_current_patient

insurance_router = APIRouter()

# Canonical US carrier list — shared with the frontend pickers. Keep in sync
# with Frontend/src/constants/insurance.js.
US_CARRIERS = [
    "Blue Cross Blue Shield",
    "Aetna",
    "Cigna",
    "UnitedHealthcare",
    "Humana",
    "Kaiser Permanente",
    "Anthem",
    "Centene",
    "Medicare",
    "Medicaid",
    "Tricare",
    "Self-Pay / Uninsured",
]


class EligibilityOutSchema(BaseModel):
    status: str            # ACTIVE | INACTIVE | NOT_FOUND | UNKNOWN | SANDBOX
    active: bool | None = None
    plan_name: str | None = None
    copay_estimate: int | None = None
    sandbox: bool = False
    message: str


_STATUS_MESSAGES = {
    "ACTIVE": "Your coverage is active.",
    "INACTIVE": "This plan is not currently active. Please check with your insurer.",
    "NOT_FOUND": "We couldn't find this plan. Double-check your member ID and carrier.",
    "UNKNOWN": "We couldn't verify coverage right now — you can still book and confirm at the visit.",
    "SANDBOX": "Demo result — connect a clearinghouse to verify real coverage.",
}


@insurance_router.get("/carriers", response_model=list[str])
def list_carriers():
    """Public: accepted US insurance carriers for the plan picker."""
    return US_CARRIERS


@insurance_router.post("/verify", response_model=EligibilityOutSchema)
def verify_my_coverage(
    current_patient: Patient = Depends(get_current_patient),
):
    """Real-time eligibility check using the patient's saved insurance details.
    Runs in sandbox mode until a clearinghouse is configured."""
    if not current_patient.insurance_plan:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Add your insurance plan and member ID to your profile first.",
        )

    from clients.eligibility import check_eligibility
    result = check_eligibility(
        plan=current_patient.insurance_plan,
        member_id=current_patient.insurance_member_id,
        group_number=current_patient.insurance_group_number,
        patient_name=current_patient.name,
    )
    return {**result, "message": _STATUS_MESSAGES.get(result["status"], "")}
