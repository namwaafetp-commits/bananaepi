from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.analytic import run_analytic
from app.services.descriptive import run_descriptive
from app.services.visualization import (
    generate_epicurve,
    epicurve_rows,
    epicurve_stacked,
    generate_age_sex_pyramid,
    generate_attack_rate_chart,
    generate_forest_plot,
    generate_symptom_bar,
)
from app.utils import load_cleaned_df, load_metadata

router = APIRouter()


@router.get("/{project_id}/descriptive", summary="Descriptive analysis (time-place-person)")
def descriptive(project_id: str):
    load_metadata(project_id)
    df = load_cleaned_df(project_id)
    return run_descriptive(df)


@router.get("/{project_id}/analytic", summary="Analytic analysis — RR or OR, CI, p-values for all exposure_* variables")
def analytic(
    project_id: str,
    outcome_col: str = Query(default="case_status", description="Binary outcome column (1=case, 0=non-case)"),
    measure: str = Query(default="rr", description="Effect measure: 'rr' (Risk Ratio) or 'or' (Odds Ratio)"),
):
    load_metadata(project_id)
    df = load_cleaned_df(project_id)
    result = run_analytic(df, outcome_col=outcome_col, measure=measure)
    result["charts"] = {
        "forest_plot": generate_forest_plot(result.get("results", []), measure=measure),
    }
    return result


_STACKABLE = {
    "sex": "เพศ", "age_group": "กลุ่มอายุ", "province": "จังหวัด",
    "district": "อำเภอ", "subdistrict": "ตำบล",
    "outcome": "ผลลัพธ์", "case_status": "สถานะผู้ป่วย",
}


@router.get("/{project_id}/epicurve", summary="Epidemic curve data and chart")
def epicurve(
    project_id: str,
    by: str = Query(default="day", description="hour | day | week | month"),
    interval: int = Query(default=1, ge=1, le=24, description="Hour interval (used only when by=hour)"),
    stack_by: str | None = Query(default=None, description="Column to stack bars by"),
):
    load_metadata(project_id)
    df = load_cleaned_df(project_id)

    rows = epicurve_rows(df, by=by, interval=interval)
    stack_rows, stack_keys = (
        epicurve_stacked(df, by=by, interval=interval, stack_by=stack_by)
        if stack_by and stack_by in df.columns else ([], [])
    )
    available_stack = [
        {"col": col, "label": label}
        for col, label in _STACKABLE.items() if col in df.columns
    ]

    return {
        "rows": rows,
        "stack_rows": stack_rows,
        "stack_keys": stack_keys,
        "stack_by": stack_by,
        "available_stack": available_stack,
        "by": by,
        "interval": interval,
    }


@router.get("/{project_id}/visualizations", summary="Generate all charts for a project")
def all_visualizations(project_id: str):
    load_metadata(project_id)
    df = load_cleaned_df(project_id)
    desc = run_descriptive(df)
    analytic_result = run_analytic(df)

    return {
        "epicurve_day": generate_epicurve(df, by="day"),
        "epicurve_week": generate_epicurve(df, by="week"),
        "age_sex_pyramid": generate_age_sex_pyramid(df),
        "attack_rates": generate_attack_rate_chart(analytic_result.get("results", [])),
        "forest_plot": generate_forest_plot(analytic_result.get("results", [])),
        "symptoms": generate_symptom_bar(desc),
    }
