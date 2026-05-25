from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import get_current_user
from app.config import BUCKET_FILES
from app.routes.payment import check_upload_rate_limit
from app.services.column_mapping import profile_columns, suggest_mapping
from app.supabase_client import get_supabase
from app.utils import save_raw_file

router = APIRouter()

ALLOWED_SUFFIXES = {".csv", ".xlsx", ".xls"}
MAX_FILE_SIZE_MB = 50


@router.post("/", summary="Upload a line-list CSV or Excel file")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    # ── Rate-limit check ────────────────────────────────────────────────────────
    check_upload_rate_limit(user["user_id"])

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {ALLOWED_SUFFIXES}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB} MB limit")

    # Parse to validate
    import io
    try:
        if suffix == ".csv":
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig", dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read file: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="File is empty")

    project_id = str(uuid.uuid4())

    # Upload raw file to Supabase Storage
    save_raw_file(project_id, content, suffix)

    # Build column profiles + suggestions
    profiles    = profile_columns(df)
    suggestions = suggest_mapping(list(df.columns))
    for p in profiles:
        s = suggestions.get(p["name"], {})
        p["suggested_target"] = s.get("target")
        p["confidence"]       = s.get("confidence", 0.0)
        p["match_method"]     = s.get("method", "none")

    now = datetime.now(timezone.utc).isoformat()
    metadata = {
        "project_id":        project_id,
        "original_filename": file.filename,
        "upload_time":       now,
        "row_count":         len(df),
        "column_count":      len(df.columns),
        "columns":           list(df.columns),
        "status":            "pending_mapping",
    }

    # Insert project row into Supabase DB
    sb = get_supabase()
    sb.table("projects").insert({
        "id":                project_id,
        "user_id":           user["user_id"],
        "original_filename": file.filename,
        "status":            "pending_mapping",
        "upload_time":       now,
        "metadata":          metadata,
    }).execute()

    return {
        "project_id":   project_id,
        "filename":     file.filename,
        "row_count":    len(df),
        "column_count": len(df.columns),
        "columns":      profiles,
        "message":      "File uploaded successfully.",
    }
