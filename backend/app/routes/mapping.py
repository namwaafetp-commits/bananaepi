from __future__ import annotations

import csv
import io
import json
import math
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response

from app.auth import get_current_user
from app.services.cleaning import clean_dataframe
from app.services.cleaning_script import generate_cleaning_script
from app.services.column_groups import classify_columns
from app.services.column_mapping import apply_mapping, get_schema, profile_columns, suggest_mapping
from app.services.data_dictionary import build_data_dictionary
from app.services.mutation import apply_all_mutations
from app.services.quality_report import compute_quality_report
from app.utils import (
    download_output_file, load_metadata, load_raw_df,
    save_cleaned_df, save_metadata, save_output_file,
)

router = APIRouter()

AUTO_THRESHOLD = 0.85


def _load_raw_df(project_id: str) -> tuple[pd.DataFrame, None]:
    """Load raw DataFrame from Supabase Storage."""
    return load_raw_df(project_id), None


def _build_group_options() -> list[dict]:
    """
    Returns the group + field options for the user mapping dropdown.
    Custom-prefix groups (exposure, symptom, underlying, treatment) allow free-text names.
    """
    schema = get_schema()
    CUSTOM_PREFIX = {
        "symptom":    "symptom_",
        "exposure":   "exposure_",
        "underlying": "underlying_",
        "treatment":  "treatment_",
    }
    options = []
    for cat_id, cat in schema["categories"].items():
        options.append({
            "group_id":     cat_id,
            "label":        cat["label_en"],
            "label_th":     cat["label"],
            "allow_custom": cat_id in CUSTOM_PREFIX,
            "custom_prefix": CUSTOM_PREFIX.get(cat_id),
            "fields": [
                {
                    "value":    fid,
                    "label":    f["label_en"],
                    "label_th": f.get("label_th", ""),
                    "type":     f.get("type", "string"),
                }
                for fid, f in cat["fields"].items()
            ],
        })
    return options


# ── Step 2: Explore columns ───────────────────────────────────────────────────

@router.get("/{project_id}/columns", summary="Explore columns and get auto-mapping suggestions")
def get_columns(project_id: str, user: dict = Depends(get_current_user)):
    meta = load_metadata(project_id, user_id=user["user_id"])
    df, _ = _load_raw_df(project_id)

    profiles   = profile_columns(df)
    suggestions = suggest_mapping(list(df.columns))

    auto_mapped  = []
    needs_review = []

    for p in profiles:
        col    = p["name"]
        s      = suggestions.get(col, {})
        conf   = float(s.get("confidence") or 0.0)
        target = s.get("target")

        if conf >= AUTO_THRESHOLD and target:
            flag = "ok"
        elif target:
            flag = "low_confidence"   # has a fuzzy suggestion but below threshold
        else:
            flag = "unmatched"        # no standard column found — must be resolved by user

        entry = {
            "name":            col,
            "suggested_target": target,   # frontend expects suggested_target
            "target":          target,    # keep for backwards compat
            "confidence":      conf,
            "method":          s.get("method", "none"),
            "flag":            flag,
            "dtype":           p["dtype"],
            "non_null_pct":    p["non_null_pct"],
            "missing_pct":     round(100 - p["non_null_pct"], 1),
            "sample_values":   p["sample_values"],
        }
        if flag == "ok":
            auto_mapped.append(entry)
        else:
            needs_review.append(entry)

    all_columns = auto_mapped + needs_review
    schema_categories = get_schema().get("categories", {})

    return {
        "project_id":       project_id,
        "filename":         meta.get("original_filename"),
        "row_count":        meta.get("row_count"),
        "columns":          all_columns,       # flat array — used by ColumnMapperPage
        "auto_mapped":      auto_mapped,
        "needs_review":     needs_review,
        "group_options":    _build_group_options(),
        "schema_categories": schema_categories,
        "status":           meta.get("status"),
    }


# ── Step 6-9: Apply mapping + clean + derive + registry ───────────────────────

@router.post("/{project_id}/apply", summary="Apply column mapping, clean, and build column registry")
def apply_column_mapping(project_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
    import traceback, logging
    from fastapi.responses import JSONResponse as _JR
    import json as _json
    logger = logging.getLogger("epiassist.apply")
    try:
        result = _apply_column_mapping_impl(project_id, body, user["user_id"])
        raw = _json.dumps(result, ensure_ascii=False)
        return _JR(content=_json.loads(raw))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("apply 500:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"{type(exc).__name__}: {str(exc).encode('ascii', 'replace').decode('ascii')}",
        ) from exc


def _apply_column_mapping_impl(project_id: str, body: dict, user_id: str) -> dict:
    meta = load_metadata(project_id, user_id=user_id)
    mapping: dict[str, str] = body.get("mapping", {})
    if not isinstance(mapping, dict):
        raise HTTPException(status_code=422, detail="'mapping' must be a JSON object")

    df, _ = _load_raw_df(project_id)

    # Step 6 — Rename columns
    try:
        df_mapped, mapping_log = apply_mapping(df, mapping)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    df_raw_for_report = df_mapped.copy()

    # Step 8 — Clean values based on group/column name
    df_clean, cleaning_stats = clean_dataframe(df_mapped)

    # Step 9 — Derived variables
    df_clean, mutation_log = apply_all_mutations(df_clean)

    # Step 7 — Column registry by group
    column_groups = classify_columns(df_clean)

    # Step 10 — Before/after cleaning report
    quality_report = compute_quality_report(df_raw_for_report, df_clean, cleaning_stats)

    # ── Save cleaned CSV to Supabase Storage ─────────────────────────────────
    save_cleaned_df(project_id, df_clean)

    # ── Artifacts → Supabase Storage ─────────────────────────────────────────
    dict_rows = build_data_dictionary(df, df_clean, mapping)
    if dict_rows:
        keys = list(dict_rows[0].keys())
        buf  = io.StringIO()
        w    = csv.DictWriter(buf, fieldnames=keys)
        w.writeheader()
        for row in dict_rows:
            flat = {
                k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v)
                for k, v in row.items()
            }
            w.writerow(flat)
        save_output_file(project_id, "data_dictionary.csv",
                         buf.getvalue().encode("utf-8-sig"), "text/csv")

    script_src = generate_cleaning_script(
        project_name=meta.get("name", meta.get("original_filename", "")),
        original_filename=meta.get("original_filename", "data.csv"),
        mapping_applied=mapping,
        cleaning_log=cleaning_stats.get("actions", []),
    )
    save_output_file(project_id, "cleaning_script.py",
                     script_src.encode("utf-8"), "text/x-python")

    # ── Metadata ───────────────────────────────────────────────────────────────
    meta.update({
        "status":           "cleaned",
        "mapping_applied":  mapping,
        "mapping_log":      mapping_log,
        "cleaned_columns":  list(df_clean.columns),
        "column_groups":    column_groups,
        "exposure_columns": column_groups.get("exposure", []),
        "symptom_columns":  column_groups.get("symptom_binary", []),
        "cleaning_log":     cleaning_stats["actions"],
        "mutation_log":     mutation_log,
        "quality_report":   quality_report,
        "artifacts":        {},
        "mapped_at":        datetime.now(timezone.utc).isoformat(),
    })
    save_metadata(project_id, meta)

    def _safe(obj):
        if isinstance(obj, dict):
            return {k: _safe(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_safe(v) for v in obj]
        if hasattr(obj, "item"):
            try:
                obj = obj.item()
            except Exception:
                return None
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        return obj

    return _safe({
        "project_id":           project_id,
        "status":               "cleaned",
        "row_count":            len(df_clean),
        "column_groups":        column_groups,
        "quality_report":       quality_report,
        "data_dictionary_rows": len(dict_rows),
        "message":              "Cleaning complete.",
    })


# ── Artifact downloads ────────────────────────────────────────────────────────

@router.get("/{project_id}/download/cleaned", summary="Download cleaned CSV")
def download_cleaned(project_id: str, user: dict = Depends(get_current_user)):
    meta = load_metadata(project_id, user_id=user["user_id"])
    data = download_output_file(project_id, "cleaned.csv") if False else None
    # Serve directly from Supabase Storage via cleaned bucket
    from app.utils import _storage_download
    from app.config import BUCKET_CLEANED
    try:
        data = _storage_download(BUCKET_CLEANED, f"{project_id}/cleaned.csv")
    except Exception:
        raise HTTPException(status_code=404, detail="Cleaned file not found")
    filename = f"cleaned_{meta.get('original_filename', project_id + '.csv')}"
    return Response(content=data, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{project_id}/download/dictionary", summary="Download data dictionary CSV")
def download_dictionary(project_id: str, user: dict = Depends(get_current_user)):
    load_metadata(project_id, user_id=user["user_id"])
    try:
        data = download_output_file(project_id, "data_dictionary.csv")
    except Exception:
        raise HTTPException(status_code=404, detail="Data dictionary not ready. Apply mapping first.")
    return Response(content=data, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="data_dictionary_{project_id[:8]}.csv"'})


@router.get("/{project_id}/download/script", summary="Download Python cleaning script")
def download_script(project_id: str, user: dict = Depends(get_current_user)):
    load_metadata(project_id, user_id=user["user_id"])
    try:
        data = download_output_file(project_id, "cleaning_script.py")
    except Exception:
        raise HTTPException(status_code=404, detail="Cleaning script not ready. Apply mapping first.")
    return Response(content=data, media_type="text/x-python",
                    headers={"Content-Disposition": f'attachment; filename="cleaning_script_{project_id[:8]}.py"'})
