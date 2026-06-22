"""Tests for US insurance eligibility verification + carrier list."""
import clients.eligibility as elig


class TestCarriers:
    def test_carrier_list_public(self, client):
        resp = client.get("/v1/insurance/carriers")
        assert resp.status_code == 200
        carriers = resp.json()
        assert "UnitedHealthcare" in carriers
        assert "Medicare" in carriers


class TestEligibilityVerify:
    def test_requires_insurance_on_file(self, client, auth_header):
        resp = client.post("/v1/insurance/verify", headers=auth_header)
        assert resp.status_code == 422  # no plan saved yet

    def test_active_coverage(self, client, auth_header, monkeypatch):
        client.put("/v1/patients/me", headers=auth_header,
                   json={"insurance_plan": "Aetna", "insurance_member_id": "A123"})
        monkeypatch.setattr(elig, "_provider_check", lambda *a, **k: {
            "status": "ACTIVE", "active": True, "plan_name": "Aetna PPO",
            "copay_estimate": 25, "sandbox": False,
        })
        resp = client.post("/v1/insurance/verify", headers=auth_header)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ACTIVE"
        assert body["active"] is True
        assert body["copay_estimate"] == 25
        assert "active" in body["message"].lower()

    def test_inactive_coverage(self, client, auth_header, monkeypatch):
        client.put("/v1/patients/me", headers=auth_header,
                   json={"insurance_plan": "Cigna", "insurance_member_id": "C999"})
        monkeypatch.setattr(elig, "_provider_check", lambda *a, **k: {
            "status": "INACTIVE", "active": False, "plan_name": "Cigna",
            "copay_estimate": None, "sandbox": False,
        })
        resp = client.post("/v1/insurance/verify", headers=auth_header)
        assert resp.json()["status"] == "INACTIVE"

    def test_clearinghouse_outage_is_unknown_not_error(self, monkeypatch):
        """A provider outage must downgrade to UNKNOWN, never raise."""
        import os

        def _boom(*a, **k):
            raise ConnectionError("clearinghouse down")
        monkeypatch.setattr(elig, "_provider_check", _boom)
        monkeypatch.setattr(elig.settings, "eligibility_provider", "stedi")
        monkeypatch.setattr(elig.settings, "eligibility_api_key", "key")
        monkeypatch.delenv("TESTING", raising=False)  # exercise the prod wrapper
        try:
            out = elig.check_eligibility(plan="Humana", member_id="H1")
        finally:
            os.environ["TESTING"] = "True"
        assert out["status"] == "UNKNOWN"
        assert out["active"] is None

    def test_requires_auth(self, client):
        assert client.post("/v1/insurance/verify").status_code == 401


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload
    def json(self):
        return self._payload
    def raise_for_status(self):
        pass


class TestStediAdapter:
    def test_active_with_copay(self, monkeypatch):
        monkeypatch.setattr(elig.httpx, "post", lambda *a, **k: _FakeResp({
            "benefitsInformation": [
                {"code": "1", "serviceTypeCodes": ["30"]},
                {"code": "B", "benefitAmount": "25"},
            ],
        }))
        out = elig._stedi_check("Aetna", "A123", None, "John Doe")
        assert out["status"] == "ACTIVE"
        assert out["active"] is True
        assert out["copay_estimate"] == 25
        assert out["sandbox"] is False

    def test_inactive(self, monkeypatch):
        monkeypatch.setattr(elig.httpx, "post", lambda *a, **k: _FakeResp({
            "benefitsInformation": [{"code": "6"}],
        }))
        out = elig._stedi_check("Cigna", "C1", None, "Jane Roe")
        assert out["status"] == "INACTIVE"
        assert out["active"] is False

    def test_unknown_carrier_skips_http(self, monkeypatch):
        def _boom(*a, **k):
            raise AssertionError("should not call the clearinghouse without a payer ID")
        monkeypatch.setattr(elig.httpx, "post", _boom)
        out = elig._stedi_check("Totally Unknown Plan", "X1", None, "A B")
        assert out["status"] == "NOT_FOUND"

    def test_payer_map_override(self, monkeypatch):
        monkeypatch.setattr(elig.settings, "eligibility_payer_map",
                            '{"My Local BCBS":"84980"}')
        assert elig._resolve_payer_id("My Local BCBS") == "84980"


class TestSandbox:
    def test_sandbox_result_deterministic(self):
        # even last digit → active, odd → inactive (demo only)
        even = elig._sandbox_result("PPO", "MEM2")
        odd = elig._sandbox_result("PPO", "MEM3")
        assert even["active"] is True and even["status"] == "SANDBOX"
        assert odd["active"] is False


class TestProfileInsuranceFields:
    def test_member_id_and_group_persist(self, client, auth_header):
        resp = client.put("/v1/patients/me", headers=auth_header, json={
            "insurance_plan": "Blue Cross Blue Shield",
            "insurance_member_id": "XYZ123456",
            "insurance_group_number": "GRP-77",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["insurance_member_id"] == "XYZ123456"
        assert body["insurance_group_number"] == "GRP-77"
