from datetime import datetime, timezone
import io
import time
import pandas as pd
from fastapi import APIRouter, Body, Depends, HTTPException

from app.auth import get_current_user
from app.utils import load_cleaned_df, load_metadata, save_cleaned_df, save_metadata
from app.services.column_groups import classify_columns

from app.schemas.case_definition_schema import CaseDefinitionDraft, ApplyCaseDefinitionRequest, PreviewCaseDefinitionRequest
from app.services.case_definition_text import generate_human_readable_text
from app.services.case_definition_evaluator import apply_case_definition
from app.services.case_definition_preview import generate_preview

router = APIRouter()

# Groups from column_groups that are relevant for building a case definition
_CASE_DEF_GROUPS = ["time", "place", "symptom_binary", "symptom_numeric", "lab"]


def _col_values(df: pd.DataFrame, col: str, group: str) -> dict:
    """Return value metadata for a single column based on its group."""
    if col not in df.columns:
        return {}

    series = df[col].dropna()

    if group == "time":
        dates = pd.to_datetime(series, errors="coerce").dropna()
        if dates.empty:
            return {"sample": series.astype(str).unique().tolist()[:10]}
        return {
            "min": str(dates.min().date()),
            "max": str(dates.max().date()),
            "sample": sorted(dates.dt.date.astype(str).unique().tolist())[:10],
        }

    if group in ("place", "lab", "demographic"):
        unique_vals = series.astype(str).unique().tolist()
        # For numeric demographic columns (age) return min/max instead of a long list
        numeric = pd.to_numeric(series, errors="coerce").dropna()
        if len(numeric) == len(series) and not numeric.empty:
            return {
                "dtype": "numeric",
                "min": float(numeric.min()),
                "max": float(numeric.max()),
            }
        return {"values": sorted(unique_vals)[:100]}

    if group == "symptom_binary":
        return {"dtype": "binary", "min": 0, "max": 1}

    if group in ("symptom_numeric", "exposure"):
        numeric = pd.to_numeric(series, errors="coerce").dropna()
        if numeric.empty:
            return {"dtype": "numeric", "min": 0, "max": 0}
        return {
            "dtype": "numeric",
            "min": float(numeric.min()),
            "max": float(numeric.max()),
            "sample": series.astype(str).unique().tolist()[:8],
        }

    return {}


@router.get("/{project_id}/columns", summary="Available columns for case definition")
def get_columns(project_id: str, user: dict = Depends(get_current_user)):
    meta = load_metadata(project_id, user_id=user["user_id"])
    if meta.get("status") not in ("cleaned", "case_defined"):
        raise HTTPException(400, "Run column mapping first before setting a case definition.")

    saved_groups = meta.get("column_groups")
    if not saved_groups:
        df = load_cleaned_df(project_id)
        saved_groups = classify_columns(df)

    df = load_cleaned_df(project_id)

    result_groups = {}
    for group in _CASE_DEF_GROUPS:
        cols = saved_groups.get(group, [])
        if not cols:
            continue
        result_groups[group] = {
            "columns": cols,
            "values": {col: _col_values(df, col, group) for col in cols},
        }

    # Flat arrays for CaseDefinitionPage frontend component
    return {
        "project_id":              project_id,
        "groups":                  result_groups,
        "symptom_columns":         saved_groups.get("symptom_binary", []),
        "numeric_symptom_columns": saved_groups.get("symptom_numeric", []),
        "lab_columns":             saved_groups.get("lab", []),
        "time_columns":            saved_groups.get("time", []),
        "place_columns":           saved_groups.get("place", []),
    }


@router.post("/{project_id}/draft", summary="Draft and generate human readable text")
def draft_case_definition(project_id: str, request: CaseDefinitionDraft, user: dict = Depends(get_current_user)):
    rule_json = request.model_dump()
    text = generate_human_readable_text(rule_json)
    return {
        "case_definition_name": request.case_definition_name,
        "human_readable_text": text,
        "warnings": []
    }


@router.post("/{project_id}/preview", summary="Preview case definition result")
def preview_case_definition(project_id: str, request: PreviewCaseDefinitionRequest, user: dict = Depends(get_current_user)):
    df = load_cleaned_df(project_id)
    rule_json = request.rule_json.model_dump()
    
    preview_data = generate_preview(df, rule_json)

    if preview_data.get("errors"):
        raise HTTPException(status_code=400, detail={"errors": preview_data["errors"]})

    text = generate_human_readable_text(rule_json)

    return {
        "human_readable_text": text,
        "summary":      preview_data["summary"],
        "preview_rows": preview_data["preview_rows"],
        "warnings":     preview_data["warnings"],
        "errors":       [],
    }


@router.post("/{project_id}/apply", summary="Apply case definition and save to dataset")
def apply_case_definition_route(project_id: str, request: ApplyCaseDefinitionRequest, user: dict = Depends(get_current_user)):
    meta = load_metadata(project_id, user_id=user["user_id"])
    df = load_cleaned_df(project_id)
    
    rule_json  = request.rule_json.model_dump()
    output_col = request.output_column

    # Validate before saving — same rules as preview
    validation = generate_preview(df, rule_json, output_col=output_col)
    if validation.get("errors"):
        raise HTTPException(status_code=400, detail={"errors": validation["errors"]})

    # 1. Apply logic
    df = apply_case_definition(df, rule_json, output_col=output_col)
    
    # Also save the old 'case_status' as required by analysis route for now (1=case, 0=non_case)
    # The MVP playbook says "Analysis uses met_case_def as the main outcome".
    # For backward compatibility with existing routes if they rely on case_status
    df["case_status"] = df["case_def_status"].map({"case": 1, "non_case": 0, "unknown": pd.NA})
    
    # 2. Save CSV to Supabase Storage
    save_cleaned_df(project_id, df)

    # 2b. Verify the write propagated before returning — Supabase Storage can take
    #     several seconds to make the new object visible on subsequent reads.
    #     Poll up to 8 times (4 s) until the saved column is readable.
    for attempt in range(8):
        try:
            verify_data = load_cleaned_df(project_id)
            if output_col in verify_data.columns:
                print(f"[apply] write verified on attempt {attempt + 1}", flush=True)
                break
        except Exception:
            pass
        time.sleep(0.5)
    else:
        print(f"[apply] WARNING: could not verify write after 4 s — proceeding anyway", flush=True)

    # 3. Generate summary
    preview_data = generate_preview(df, rule_json, output_col=output_col)
    text = generate_human_readable_text(rule_json)
    
    case_def_id = f"case_def_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    
    case_def_obj = {
        "case_definition_id": case_def_id,
        "project_id": project_id,
        "case_definition_name": request.case_definition_name,
        "version": request.rule_json.version,
        "output_column": output_col,
        "rule_json": rule_json,
        "human_readable_text": text,
        "result_summary": preview_data["summary"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "user"
    }
    
    # Save to metadata
    meta.update({
        "status": "case_defined",
        "active_case_definition": case_def_obj,
        "n_cases": preview_data["summary"]["case_count"],
        "n_controls": preview_data["summary"]["non_case_count"],
        "case_defined_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Keep historical versions (simplified MVP)
    history = meta.get("case_definition_history", [])
    history.append(case_def_obj)
    meta["case_definition_history"] = history
    
    save_metadata(project_id, meta)
    
    return {
        "case_definition_id": case_def_id,
        "version": request.rule_json.version,
        "output_column": output_col,
        "summary": preview_data["summary"],
        "human_readable_text": text
    }


@router.get("/{project_id}/active", summary="Get active case definition")
def get_active_case_definition(project_id: str, user: dict = Depends(get_current_user)):
    meta = load_metadata(project_id, user_id=user["user_id"])
    active = meta.get("active_case_definition")
    if not active:
        raise HTTPException(status_code=404, detail="No active case definition found")
    return active
