from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.config import BUCKET_CLEANED, BUCKET_FILES, BUCKET_OUTPUTS
from app.services.column_groups import classify_columns
from app.supabase_client import get_supabase
from app.utils import load_cleaned_df, load_metadata, save_metadata

router = APIRouter()


@router.get("/", summary="List all projects for the authenticated user")
def list_projects(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("projects") \
        .select("id, original_filename, status, upload_time, metadata") \
        .eq("user_id", user["user_id"]) \
        .order("upload_time", desc=True) \
        .execute()

    projects = []
    for row in (result.data or []):
        meta = row.get("metadata") or {}
        projects.append({
            "project_id":       row["id"],
            "filename":         row.get("original_filename"),
            "upload_time":      row.get("upload_time"),
            "row_count":        meta.get("row_count"),
            "exposure_columns": meta.get("exposure_columns", []),
            "status":           row.get("status"),
        })

    return {"projects": projects, "total": len(projects)}


@router.get("/{project_id}", summary="Get project details and metadata")
def get_project(project_id: str, user: dict = Depends(get_current_user)):
    return load_metadata(project_id, user_id=user["user_id"])


@router.get("/{project_id}/preview", summary="Preview first N rows of cleaned data")
def preview_project(project_id: str, rows: int = 10, user: dict = Depends(get_current_user)):
    load_metadata(project_id, user_id=user["user_id"])  # 404 / ownership check
    sb = get_supabase()
    try:
        data = sb.storage.from_(BUCKET_CLEANED).download(f"{project_id}/cleaned.csv")
        df = pd.read_csv(io.BytesIO(data), nrows=rows, dtype=str)
        return {
            "rows":          df.fillna("").to_dict(orient="records"),
            "columns":       list(df.columns),
            "preview_count": len(df),
        }
    except Exception:
        raise HTTPException(status_code=404, detail="Cleaned file not found")


@router.get("/{project_id}/column-groups", summary="Get standardised column groups for this project")
def get_column_groups(project_id: str, user: dict = Depends(get_current_user)):
    meta   = load_metadata(project_id, user_id=user["user_id"])
    groups = meta.get("column_groups")
    if not groups:
        df     = load_cleaned_df(project_id)
        groups = classify_columns(df)
        meta["column_groups"] = groups
        save_metadata(project_id, meta)
    return {"project_id": project_id, "column_groups": groups}


@router.delete("/{project_id}", summary="Delete a project and all its files")
def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    load_metadata(project_id, user_id=user["user_id"])  # 404 / ownership check

    sb      = get_supabase()
    deleted = []

    # Remove files from Storage buckets (ignore errors for missing files)
    for bucket, paths in [
        (BUCKET_FILES,   [f"{project_id}/raw.csv", f"{project_id}/raw.xlsx", f"{project_id}/raw.xls"]),
        (BUCKET_CLEANED, [f"{project_id}/cleaned.csv"]),
        (BUCKET_OUTPUTS, [
            f"{project_id}/report_en.docx",
            f"{project_id}/report_th.docx",
            f"{project_id}/data_dictionary.csv",
            f"{project_id}/cleaning_script.py",
        ]),
    ]:
        try:
            sb.storage.from_(bucket).remove(paths)
            deleted.extend(paths)
        except Exception:
            pass

    # Delete DB row (share_links cascade-delete automatically)
    sb.table("projects").delete().eq("id", project_id).execute()

    return {"message": f"Project {project_id} deleted", "deleted_files": deleted}
