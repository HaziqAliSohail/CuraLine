"""Tests for the app-level rate limiter.

In TESTING mode the dependency is disabled (so the rest of the suite is
unaffected), so these tests exercise the underlying logic directly with a
fake Redis to prove it both throttles and fails open.
"""
import web.auth.ratelimit as rl
from fastapi import HTTPException


class _FakeRedis:
    def __init__(self):
        self.store = {}
    def incr(self, key):
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]
    def expire(self, key, ttl):
        pass


class _DownRedis:
    def incr(self, key):
        raise ConnectionError("redis down")
    def expire(self, key, ttl):
        raise ConnectionError("redis down")


class _Req:
    def __init__(self, ip="1.2.3.4"):
        self.headers = {}
        self.client = type("C", (), {"host": ip})()


def _run(dep, req, monkeypatch, redis_obj):
    monkeypatch.setattr(rl, "_redis", lambda: redis_obj)
    monkeypatch.delenv("TESTING", raising=False)
    return dep(req)


def test_allows_under_limit(monkeypatch):
    dep = rl.rate_limit("t", limit=3, window_seconds=60)
    fake = _FakeRedis()
    for _ in range(3):
        _run(dep, _Req(), monkeypatch, fake)  # no raise


def test_blocks_over_limit(monkeypatch):
    dep = rl.rate_limit("t", limit=3, window_seconds=60)
    fake = _FakeRedis()
    req = _Req()
    for _ in range(3):
        _run(dep, req, monkeypatch, fake)
    try:
        _run(dep, req, monkeypatch, fake)
        assert False, "expected 429"
    except HTTPException as e:
        assert e.status_code == 429


def test_separate_ips_independent(monkeypatch):
    dep = rl.rate_limit("t", limit=1, window_seconds=60)
    fake = _FakeRedis()
    _run(dep, _Req("10.0.0.1"), monkeypatch, fake)
    _run(dep, _Req("10.0.0.2"), monkeypatch, fake)  # different IP, allowed


def test_fails_open_when_redis_down(monkeypatch):
    dep = rl.rate_limit("t", limit=1, window_seconds=60)
    # Many calls, redis raising every time → never blocks
    for _ in range(5):
        _run(dep, _Req(), monkeypatch, _DownRedis())


def test_disabled_in_testing_mode(monkeypatch):
    dep = rl.rate_limit("t", limit=1, window_seconds=60)
    monkeypatch.setenv("TESTING", "True")
    # Even over limit, TESTING short-circuits to allow
    for _ in range(5):
        dep(_Req())
