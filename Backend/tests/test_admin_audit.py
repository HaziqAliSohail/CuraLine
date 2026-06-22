"""Admin audit-log viewer."""
from models.audit_log import AuditLog


def _seed_log(db, action="appointment.cancel", role="patient"):
    db.add(AuditLog(actor_role=role, actor_id=1, action=action,
                    target_type="appointment", target_id=9, ip_address="127.0.0.1"))
    db.commit()


def test_admin_can_list_audit_logs(client, admin_header, db):
    _seed_log(db, action="consent.accept")
    r = client.get("/v1/admin/audit-logs", headers=admin_header)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert any(i["action"] == "consent.accept" for i in body["items"])


def test_audit_logs_filterable(client, admin_header, db):
    _seed_log(db, action="appointment.cancel")
    _seed_log(db, action="consent.accept")
    r = client.get("/v1/admin/audit-logs", headers=admin_header, params={"action": "consent.accept"})
    assert r.status_code == 200
    assert all(i["action"] == "consent.accept" for i in r.json()["items"])


def test_non_admin_forbidden(client, auth_header):
    assert client.get("/v1/admin/audit-logs", headers=auth_header).status_code == 403


def test_requires_auth(client):
    assert client.get("/v1/admin/audit-logs").status_code == 401
