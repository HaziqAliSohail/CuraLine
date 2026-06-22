"""FHIR R4 export."""


def test_admin_exports_appointment_bundle(client, admin_header, sample_appointment):
    r = client.get(f"/v1/fhir/appointments/{sample_appointment.id}", headers=admin_header)
    assert r.status_code == 200
    bundle = r.json()
    assert bundle["resourceType"] == "Bundle"
    types = {e["resource"]["resourceType"] for e in bundle["entry"]}
    assert types == {"Patient", "Appointment"}
    appt = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Appointment")
    assert appt["status"] == "booked"  # SCHEDULED -> booked


def test_non_admin_forbidden(client, auth_header, sample_appointment):
    assert client.get(f"/v1/fhir/appointments/{sample_appointment.id}", headers=auth_header).status_code == 403


def test_missing_appointment_404(client, admin_header):
    assert client.get("/v1/fhir/appointments/999999", headers=admin_header).status_code == 404


def test_status_mapping():
    from clients import fhir

    class _Slot:
        date = __import__("datetime").date(2026, 1, 1)
        start_time = __import__("datetime").time(9, 0)

    class _Appt:
        id = 1; patient_id = 2; doctor_id = 3; reason = "cough"; status = "COMPLETED"; slot = _Slot()

    res = fhir.appointment_resource(_Appt())
    assert res["status"] == "fulfilled"
    assert res["start"].startswith("2026-01-01T09:00")
