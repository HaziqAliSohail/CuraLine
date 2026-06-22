"""
Application-level rate limiting - host-independent (works even when deployed
without nginx, e.g. on Railway/Render/Fly).

Backed by Redis so the limit is shared across all web workers. Fails OPEN: if
Redis is unavailable the request is allowed, because a limiter outage must never
take down login. In TESTING mode it is disabled entirely.

Usage:
    @router.post("/login", dependencies=[Depends(rate_limit("login", 10, 60))])
"""
import os
import time

from fastapi import Depends, HTTPException, Request, status

from settings import settings

_redis_client = None


def _redis():
    global _redis_client
    if _redis_client is None:
        import redis
        _redis_client = redis.Redis.from_url(
            settings.redis_url, socket_connect_timeout=1, socket_timeout=1
        )
    return _redis_client


def rate_limit(bucket: str, limit: int, window_seconds: int):
    """Return a dependency that allows `limit` requests per `window_seconds`
    per client IP for the named bucket."""

    def _dependency(request: Request):
        if os.environ.get("TESTING") == "True":
            return
        # Trust X-Forwarded-For's first hop when behind a proxy, else peer IP
        fwd = request.headers.get("x-forwarded-for")
        client_ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
        # Fixed-window counter keyed to the current window
        window = int(time.time()) // window_seconds
        key = f"rl:{bucket}:{client_ip}:{window}"
        try:
            r = _redis()
            count = r.incr(key)
            if count == 1:
                r.expire(key, window_seconds)
            if count > limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please wait a moment and try again.",
                )
        except HTTPException:
            raise
        except Exception:
            # Redis down → fail open (nginx is the backstop in the default deploy)
            return

    return _dependency
