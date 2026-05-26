from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from app.auth import get_current_user
from app.utils import load_cleaned_df, load_metadata
from app.services.dashboard_overview import generate_overview
from app.services.dashboard_time import generate_time
from app.services.dashboard_place import generate_place
from app.services.dashboard_person import generate_person
from app.services.dashboard_exposure import generate_exposure
from app.services.dashboard_analytic import generate_analytic
from app.services.dashboard_data_quality import generate_data_quality
from app.services.case_definition_text import generate_human_readable_text

router = APIRouter(prefix="/projects", tags=["dashboard"])

_FALLBACK_OUTPUT_COLS = ["met_case_def", "case_status", "case_def", "is_case"]


def _resolve_output_col(df, meta: dict) -> tuple[str, bool]:
    """
    Returns (output_col_name, has_real_case_def).
    Never raises — if no case-def column exists, injects a synthetic
    '_all_cases' column (all 1s) so the dashboard still loads.
    """
    active = meta.get("active_case_definition") or {}
    stored = active.get("output_column")
    if stored and stored in df.columns:
        return stored, True
    for col in _FALLBACK_OUTPUT_COLS:
        if col in df.columns:
            return col, True
    # No case definition applied yet — treat every row as a case so
    # the dashboard still renders; caller will add a warning.
    df["_all_cases"] = 1.0
    return "_all_cases", False


def _build_case_definition(meta: dict, has_case_def: bool) -> dict | None:
    """
    Build the case_definition payload for the dashboard response.
    Tries stored human_readable_text first; if missing, regenerates
    from rule_json on-the-fly so the box always appears when a case
    definition has been applied.
    """
    if not has_case_def:
        return None

    active_cd = meta.get("active_case_definition") or {}
    if not active_cd:
        # Column was found via fallback (e.g. old project) but no metadata stored
        return {"name": "", "human_readable": ""}

    name = active_cd.get("case_definition_name", "")

    # Prefer stored text
    hr = active_cd.get("human_readable_text", "")

    # If missing or empty, regenerate from rule_json
    if not hr:
        rule_json = active_cd.get("rule_json")
        if rule_json:
            try:
                hr = generate_human_readable_text(rule_json)
            except Exception:
                hr = ""

    return {"name": name, "human_readable": hr}



@router.get("/{project_id}/dashboard", response_model=Dict[str, Any])
def get_dashboard(project_id: str, user: dict = Depends(get_current_user)):
    df   = load_cleaned_df(project_id)
    meta = load_metadata(project_id, user_id=user["user_id"])

    if df.empty:
        raise HTTPException(status_code=404, detail="Project data not found")

    output_col, has_case_def = _resolve_output_col(df, meta)

    return {
        "project_id":          project_id,
        "has_case_definition": has_case_def,
        "case_definition":     _build_case_definition(meta, has_case_def),
        "overview":            generate_overview(df, output_col),
        "time":                generate_time(df, output_col),
        "place":               generate_place(df, output_col),
        "person":              generate_person(df, output_col),
        "exposure":            generate_exposure(df, output_col),
        "analytic":            generate_analytic(df, output_col),
        "data_quality":        generate_data_quality(df, output_col),
    }
