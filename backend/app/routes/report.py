from __future__ import annotations

import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.auth import get_current_user
from app.config import TEMP_DIR
from app.utils import download_output_file, load_cleaned_df, load_metadata, save_metadata, save_output_file

from app.services.dashboard_overview  import generate_overview
from app.services.dashboard_time      import generate_time
from app.services.dashboard_person    import generate_person
from app.services.dashboard_place     import generate_place
from app.services.dashboard_exposure  import generate_exposure
from app.services.dashboard_analytic  import generate_analytic

from app.services.report import generate_word_report
from app.services.visualization import (
    generate_epicurve,
    generate_age_sex_pyramid,
    generate_attack_rate_chart,
    generate_forest_plot,
    generate_symptom_bar_from_person,
)

router = APIRouter()

_FALLBACK_OUTPUT_COLS = ["met_case_def", "case_status", "case_def", "is_case"]


def _resolve_output_col(df, meta: dict) -> str:
    active = meta.get("active_case_definition") or {}
    stored = active.get("output_column")
    if stored and stored in df.columns:
        return stored
    for col in _FALLBACK_OUTPUT_COLS:
        if col in df.columns:
            return col
    # No case-def column — treat all rows as cases so the report still generates
    df["_all_cases"] = 1.0
    return "_all_cases"


def _norm_analytic(results: list[dict]) -> list[dict]:
    out = []
    for r in results:
        tb = r.get("table") or {}
        out.append({
            **r,
            "rr":               r.get("estimate"),
            "ar_exposed_pct":   r.get("ar_exposed"),
            "ar_unexposed_pct": r.get("ar_unexposed"),
            "exposed_cases":    tb.get("cases_exposed"),
            "exposed_total":    tb.get("total_exposed"),
            "unexposed_cases":  tb.get("cases_unexposed"),
            "unexposed_total":  tb.get("total_unexposed"),
            "significant":      "significant" in r.get("flags", []),
        })
    return out


@router.post("/{project_id}/generate", summary="Generate Word report for a project")
def generate_report(
    project_id: str,
    lang: str = Query(default="en", description="Report language: 'en' or 'th'"),
    user: dict = Depends(get_current_user),
):
    lang = lang if lang in ("en", "th") else "en"

    df   = load_cleaned_df(project_id)
    meta = load_metadata(project_id, user_id=user["user_id"])
    output_col = _resolve_output_col(df, meta)

    dashboard = {
        "overview":  generate_overview(df, output_col),
        "time":      generate_time(df, output_col),
        "person":    generate_person(df, output_col),
        "place":     generate_place(df, output_col),
        "exposure":  generate_exposure(df, output_col),
        "analytic":  generate_analytic(df, output_col),
    }

    analytic_norm = _norm_analytic(dashboard["analytic"].get("results", []))
    charts = {
        "epicurve":        generate_epicurve(df, by="day"),
        "age_sex_pyramid": generate_age_sex_pyramid(df),
        "attack_rates":    generate_attack_rate_chart(analytic_norm),
        "forest_plot":     generate_forest_plot(analytic_norm),
        "symptoms":        generate_symptom_bar_from_person(dashboard["person"].get("symptoms", [])),
    }

    # Generate Word report to a temp file, then upload to Storage
    report_filename = f"report_{lang}.docx"
    tmp_path = TEMP_DIR / f"{project_id}_{report_filename}"
    generate_word_report(meta, dashboard, analytic_norm, charts, tmp_path, lang=lang)

    with open(tmp_path, "rb") as f:
        report_bytes = f.read()
    tmp_path.unlink(missing_ok=True)

    save_output_file(
        project_id, report_filename, report_bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    meta[f"report_filename_{lang}"] = report_filename
    meta["status"] = "reported"
    save_metadata(project_id, meta)

    return {
        "message":         "Report generated successfully",
        "project_id":      project_id,
        "lang":            lang,
        "report_filename": report_filename,
        "download_url":    f"/report/{project_id}/download?lang={lang}",
    }


@router.get("/{project_id}/download", summary="Download the generated Word report")
def download_report(
    project_id: str,
    lang: str = Query(default="en"),
    user: dict = Depends(get_current_user),
):
    lang = lang if lang in ("en", "th") else "en"
    load_metadata(project_id, user_id=user["user_id"])

    try:
        report_bytes = download_output_file(project_id, f"report_{lang}.docx")
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Report not found. Call POST /report/{project_id}/generate first.",
        )

    suffix = "_th" if lang == "th" else ""
    return Response(
        content=report_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="outbreak_report{suffix}_{project_id[:8]}.docx"'},
    )
