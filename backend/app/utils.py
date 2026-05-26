from __future__ import annotations

import io
from datetime import datetime, timezone

import pandas as pd
from fastapi import HTTPException

from app.config import BUCKET_FILES, BUCKET_CLEANED
from app.supabase_client import get_supabase

DATE_COLS = ["date_onset", "date_report", "date_admitted", "date_outcome"]


# ── Metadata (PostgreSQL projects table) ─────────────────────


def load_metadata(project_id: str, user_id: str | None = None) -> dict:
    """
    Load project metadata from Supabase DB.
    If user_id is provided, ownership is verified.
    """
    sb = get_supabase()
    query = sb.table("projects").select("*").eq("id", project_id)
    if user_id:
        query = query.eq("user_id", user_id)
    result = query.maybe_single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    row = result.data
    # Flatten: merge stored metadata blob with top-level DB columns
    meta: dict = row.get("metadata") or {}
    meta["project_id"]        = row["id"]
    meta["original_filename"] = row.get("original_filename", meta.get("original_filename"))
    meta["status"]            = row.get("status", meta.get("status"))
    meta["upload_time"]       = row.get("upload_time", meta.get("upload_time"))
    meta["user_id"]           = row.get("user_id")
    return meta


def save_metadata(project_id: str, metadata: dict) -> None:
    """Update project row in Supabase DB."""
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    sb.table("projects").update({
        "original_filename": metadata.get("original_filename"),
        "status":            metadata.get("status"),
        "updated_at":        now,
        "metadata":          metadata,
    }).eq("id", project_id).execute()


# ── File I/O (Supabase Storage) ───────────────────────────────


def _storage_download(bucket: str, path: str) -> bytes:
    sb = get_supabase()
    try:
        return sb.storage.from_(bucket).download(path)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"File not found: {path} — {exc}")


def _storage_upload(bucket: str, path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    """Upload (create-or-replace) a file in Supabase Storage.

    Uses a direct HTTP POST with x-upsert=true instead of the SDK's
    upload/update helpers, which have been observed to silently fail to
    replace existing file content despite returning no error.
    """
    import httpx
    from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
        "cache-control": "no-cache",
    }
    print(f"[storage] uploading {bucket}/{path} ({len(data)} bytes)", flush=True)
    resp = httpx.post(url, content=data, headers=headers, timeout=30.0)
    print(f"[storage] → {resp.status_code}", flush=True)
    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=500,
            detail=f"Storage upload failed [{resp.status_code}]: {resp.text[:300]}",
        )


def load_raw_df(project_id: str) -> pd.DataFrame:
    """Download raw upload from Storage and return as DataFrame."""
    sb = get_supabase()
    for ext in ("csv", "xlsx", "xls"):
        try:
            data = sb.storage.from_(BUCKET_FILES).download(f"{project_id}/raw.{ext}")
            if ext == "csv":
                return pd.read_csv(io.BytesIO(data), encoding="utf-8-sig", dtype=str)
            else:
                return pd.read_excel(io.BytesIO(data), dtype=str)
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Raw file not found for project '{project_id}'")


def load_cleaned_df(project_id: str) -> pd.DataFrame:
    """Download cleaned CSV from Storage and return as DataFrame."""
    data = _storage_download(BUCKET_CLEANED, f"{project_id}/cleaned.csv")
    print(f"[load_cleaned_df] {project_id}: downloaded {len(data)} bytes", flush=True)
    df = pd.read_csv(io.BytesIO(data), low_memory=False, encoding="utf-8-sig")
    print(f"[load_cleaned_df] {project_id}: cols={list(df.columns)[:8]}...", flush=True)
    for col in DATE_COLS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def save_cleaned_df(project_id: str, df: pd.DataFrame) -> None:
    """Upload cleaned CSV to Storage."""
    buf = io.BytesIO()
    df.to_csv(buf, index=False, encoding="utf-8-sig")
    _storage_upload(BUCKET_CLEANED, f"{project_id}/cleaned.csv", buf.getvalue(), "text/csv")


def save_raw_file(project_id: str, content: bytes, suffix: str) -> None:
    """Upload raw uploaded file to Storage."""
    content_type = "text/csv" if suffix == ".csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    _storage_upload(BUCKET_FILES, f"{project_id}/raw{suffix}", content, content_type)


def save_output_file(project_id: str, filename: str, content: bytes, content_type: str) -> None:
    """Upload an output file (report, artifact) to Storage."""
    from app.config import BUCKET_OUTPUTS
    _storage_upload(BUCKET_OUTPUTS, f"{project_id}/{filename}", content, content_type)


def download_output_file(project_id: str, filename: str) -> bytes:
    """Download an output file from Storage."""
    from app.config import BUCKET_OUTPUTS
    return _storage_download(BUCKET_OUTPUTS, f"{project_id}/{filename}")
