from __future__ import annotations

from fastapi import Header, HTTPException
from app.supabase_client import get_supabase


def get_current_user(authorization: str = Header(default=None)) -> dict:
    """FastAPI dependency — validates Supabase JWT via Auth API and returns user info.

    Uses sb.auth.get_user(token) so it works regardless of the signing
    algorithm Supabase uses (currently ES256 / ECDSA P-256).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header"
        )

    token = authorization.removeprefix("Bearer ").strip()
    try:
        sb = get_supabase()
        response = sb.auth.get_user(token)
        user = response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {"user_id": user.id, "email": user.email or ""}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
