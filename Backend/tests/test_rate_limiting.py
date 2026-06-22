"""Proves the app-level rate limiter actually blocks abuse on the unauthenticated
onboarding endpoints. The limiter is disabled under TESTING, so we re-enable it
for this test and back it with an in-memory fake Redis."""
import web.auth.ratelimit as rl


class _FakeRedis:
    """Minimal incr/expire used by the fixed-window limiter."""
    def __init__(self):
        self.store = {}

    def incr(self, key):
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]

    def expire(self, key, seconds):
        pass


def _hospital_payload(i):
    return {
        "hospital_name": f"Clinic {i}",
        "admin_name": "Admin",
        "admin_email": f"ops{i}@example.org",
        "admin_password": "Admin@1234",
    }


def test_hospital_apply_is_rate_limited(client, monkeypatch):
    fake = _FakeRedis()  # one shared instance so the window counter accumulates
    monkeypatch.setattr(rl, "_redis", lambda: fake)
    monkeypatch.setenv("TESTING", "False")  # activate the limiter for this test

    codes = [client.post("/v1/auth/hospital/apply", json=_hospital_payload(i)).status_code
             for i in range(6)]

    assert codes.count(201) == 5          # apply limit is 5/min
    assert codes[-1] == 429               # the 6th is throttled
