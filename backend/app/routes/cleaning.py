from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.utils import load_metadata

router = APIRouter()


@router.get("/{project_id}/quality-report", summary="Dataset quality report after cleaning")
def quality_report(project_id: str, user: dict = Depends(get_current_user)):
    meta = load_metadata(project_id, user_id=user["user_id"])
    report = meta.get("quality_report")
    if not report:
        raise HTTPException(status_code=400, detail="Quality report not available. Apply column mapping first.")
    return report


@router.get("/{project_id}/log", summary="Cleaning action log")
def cleaning_log(project_id: str, user: dict = Depends(get_current_user)):
    meta = load_metadata(project_id, user_id=user["user_id"])
    return {
        "project_id":   project_id,
        "cleaning_log": meta.get("cleaning_log", []),
        "mapping_log":  meta.get("mapping_log", []),
        "mutation_log": meta.get("mutation_log", []),
    }
