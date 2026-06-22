from fastapi import Depends

from web.auth.security import get_current_admin


def require_admin(admin=Depends(get_current_admin)):
    """FastAPI dependency that ensures the caller is a platform operator.

    A platform admin is now a first-class identity (PlatformAdmin) authenticated
    via an `admin`-role token - not a patient account with an is_admin flag.
    Returns the PlatformAdmin; get_current_admin raises 401 for non-admin tokens.
    """
    return admin
