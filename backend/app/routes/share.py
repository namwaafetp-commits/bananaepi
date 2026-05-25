from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.auth import get_current_user
from app.supabase_client import get_supabase
from app.utils import load_cleaned_df, load_metadata
from app.services.dashboard_overview  import generate_overview
from app.services.dashboard_time      import generate_time
from app.services.dashboard_place     import generate_place
from app.services.dashboard_person    import generate_person
from app.services.dashboard_exposure  import generate_exposure
from app.services.dashboard_analytic  import generate_analytic
from app.services.dashboard_data_quality import generate_data_quality

router = APIRouter(prefix="/api/share", tags=["Share"])

_FALLBACK_OUTPUT_COLS = ["met_case_def", "case_status", "case_def", "is_case"]


def _resolve_output_col(df, meta: dict) -> str:
    active = meta.get("active_case_definition") or {}
    stored = active.get("output_column")
    if stored and stored in df.columns:
        return stored
    for col in _FALLBACK_OUTPUT_COLS:
        if col in df.columns:
            return col
    # No case-def column — treat all rows as cases so the share snapshot still works
    df["_all_cases"] = 1.0
    return "_all_cases"


def _hash_password(password: str) -> tuple[str, str]:
    salt = secrets.token_hex(16)
    key  = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return key.hex(), salt


def _verify_password(password: str, stored_hash: str, salt: str) -> bool:
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return key.hex() == stored_hash


class CreateShareRequest(BaseModel):
    project_id:       str
    password:         str
    expires_in_hours: int = 24


class AccessShareRequest(BaseModel):
    password: str


@router.post("")
def create_share(req: CreateShareRequest, user: dict = Depends(get_current_user)):
    try:
        df   = load_cleaned_df(req.project_id)
        meta = load_metadata(req.project_id, user_id=user["user_id"])
    except Exception:
        raise HTTPException(status_code=404, detail="Project not found")

    if df.empty:
        raise HTTPException(status_code=404, detail="Project data is empty")

    output_col   = _resolve_output_col(df, meta)
    project_name = meta.get("original_filename", req.project_id)

    snapshot = jsonable_encoder({
        "project_id":   req.project_id,
        "overview":     generate_overview(df, output_col),
        "time":         generate_time(df, output_col),
        "place":        generate_place(df, output_col),
        "person":       generate_person(df, output_col),
        "exposure":     generate_exposure(df, output_col),
        "analytic":     generate_analytic(df, output_col),
        "data_quality": generate_data_quality(df, output_col),
    })

    token         = uuid.uuid4().hex[:24]
    pw_hash, salt = _hash_password(req.password)
    now           = datetime.now(timezone.utc)
    expires_at    = now + timedelta(hours=req.expires_in_hours)

    sb = get_supabase()
    sb.table("share_links").insert({
        "project_id":    req.project_id,
        "token":         token,
        "password_hash": pw_hash,
        "salt":          salt,
        "project_name":  project_name,
        "expires_at":    expires_at.isoformat(),
        "snapshot":      snapshot,
    }).execute()

    return {
        "token":        token,
        "expires_at":   expires_at.isoformat(),
        "project_name": project_name,
    }


@router.get("/{token}/info")
def get_share_info(token: str):
    sb     = get_supabase()
    result = sb.table("share_links").select("project_name, expires_at") \
               .eq("token", token).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Share link not found")
    data       = result.data
    expires_at = datetime.fromisoformat(data["expires_at"])
    return {
        "project_name": data["project_name"],
        "expires_at":   data["expires_at"],
        "expired":      datetime.now(timezone.utc) > expires_at,
    }


@router.post("/{token}/access")
def access_share(token: str, req: AccessShareRequest):
    sb     = get_supabase()
    result = sb.table("share_links").select("*").eq("token", token).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Share link not found")

    data       = result.data
    expires_at = datetime.fromisoformat(data["expires_at"])

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="This share link has expired")

    if not _verify_password(req.password, data["password_hash"], data["salt"]):
        raise HTTPException(status_code=401, detail="Incorrect password")

    return data["snapshot"]
