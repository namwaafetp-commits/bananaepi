from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Any


def _safe_pct(num: int, denom: int, decimals: int = 1) -> float | None:
    if denom == 0:
        return None
    return round(num / denom * 100, decimals)


def run_descriptive(df: pd.DataFrame) -> dict[str, Any]:
    results: dict[str, Any] = {}

    # ── Overall summary ───────────────────────────────────────────────────────
    summary: dict[str, Any] = {"total_records": len(df)}

    if "date_onset" in df.columns:
        valid_dates = df["date_onset"].dropna()
        if not valid_dates.empty:
            summary["date_range"] = {
                "start": str(valid_dates.min().date()),
                "end": str(valid_dates.max().date()),
            }
            summary["duration_days"] = (valid_dates.max() - valid_dates.min()).days + 1
        else:
            summary["date_range"] = None
            summary["duration_days"] = None

    results["summary"] = summary

    # ── Case status ───────────────────────────────────────────────────────────
    if "case_status" in df.columns:
        n_cases = int((df["case_status"] == 1).sum())
        n_non = int((df["case_status"] == 0).sum())
        n_total = n_cases + n_non
        results["case_status"] = {
            "cases": n_cases,
            "non_cases": n_non,
            "total_investigated": n_total,
            "overall_attack_rate_pct": _safe_pct(n_cases, n_total),
        }
    else:
        results["case_status"] = {
            "cases": len(df),
            "note": "No 'case_status' column — all records treated as cases",
        }

    # ── Sex ───────────────────────────────────────────────────────────────────
    if "sex" in df.columns:
        counts = df["sex"].value_counts(dropna=False)
        total = len(df)
        results["sex_distribution"] = {
            str(k): {"count": int(v), "percent": _safe_pct(int(v), total)}
            for k, v in counts.items()
        }

    # ── Age ───────────────────────────────────────────────────────────────────
    if "age" in df.columns:
        age = df["age"].dropna()
        if not age.empty:
            results["age_statistics"] = {
                "mean": round(float(age.mean()), 1),
                "median": round(float(age.median()), 1),
                "std": round(float(age.std()), 1),
                "min": int(age.min()),
                "max": int(age.max()),
                "n_missing": int(df["age"].isna().sum()),
            }

    if "age_group" in df.columns:
        age_group_order = ["0-4", "5-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"]
        counts = df["age_group"].value_counts()
        ordered = {g: int(counts.get(g, 0)) for g in age_group_order if g in counts or counts.get(g, 0) > 0}
        results["age_group_distribution"] = ordered

    if "age_group" in df.columns and "sex" in df.columns:
        age_group_order = ["0-4", "5-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"]
        valid = df.dropna(subset=["age_group", "sex"])
        if not valid.empty:
            pivot = valid.groupby(["age_group", "sex"], observed=False).size().unstack(fill_value=0)
            rows_pyramid = []
            for g in age_group_order:
                if g in pivot.index:
                    rows_pyramid.append({
                        "age_group": g,
                        "male":   int(pivot.loc[g].get("Male",   0)),
                        "female": int(pivot.loc[g].get("Female", 0)),
                    })
            if rows_pyramid:
                results["age_sex_distribution"] = rows_pyramid

    # ── Outcome ───────────────────────────────────────────────────────────────
    if "outcome" in df.columns:
        counts = df["outcome"].value_counts(dropna=False)
        total = len(df)
        results["outcome_distribution"] = {
            str(k): {"count": int(v), "percent": _safe_pct(int(v), total)}
            for k, v in counts.items()
        }
        dead = int(counts.get("Dead", 0))
        alive = int(counts.get("Alive", 0))
        denom = dead + alive
        results["case_fatality_rate_pct"] = _safe_pct(dead, denom)

    # ── Lab confirmation ──────────────────────────────────────────────────────
    if "lab_confirmed" in df.columns:
        confirmed = int((df["lab_confirmed"] == True).sum())   # noqa: E712
        not_confirmed = int((df["lab_confirmed"] == False).sum())  # noqa: E712
        unknown = int(df["lab_confirmed"].isna().sum())
        results["lab_confirmation"] = {
            "confirmed": confirmed,
            "not_confirmed": not_confirmed,
            "unknown": unknown,
            "confirmation_rate_pct": _safe_pct(confirmed, confirmed + not_confirmed),
        }

    # ── Hospitalization ───────────────────────────────────────────────────────
    if "hospitalized" in df.columns:
        hosp = int((df["hospitalized"] == True).sum())   # noqa: E712
        not_hosp = int((df["hospitalized"] == False).sum())  # noqa: E712
        results["hospitalization"] = {
            "hospitalized": hosp,
            "not_hospitalized": not_hosp,
            "hospitalization_rate_pct": _safe_pct(hosp, hosp + not_hosp),
        }

    # ── Geographic distribution ───────────────────────────────────────────────
    geo_total = len(df)
    GEO_LEVELS = [
        ("province",    "จังหวัด"),
        ("district",    "อำเภอ"),
        ("subdistrict", "ตำบล"),
        ("village",     "หมู่บ้าน"),
        ("address",     "ที่อยู่"),
    ]
    geo_result: dict[str, Any] = {}

    for col, label in GEO_LEVELS:
        if col in df.columns:
            counts = df[col].value_counts(dropna=True)
            geo_result[col] = {
                "label": label,
                "data": {
                    str(k): {"count": int(v), "percent": _safe_pct(int(v), geo_total)}
                    for k, v in counts.items()
                },
            }

    # custom place_* columns (mapped by user)
    for col in df.columns:
        if col.startswith("place_"):
            counts = df[col].value_counts(dropna=True)
            label = col.replace("place_", "").replace("_", " ").title()
            geo_result[col] = {
                "label": label,
                "data": {
                    str(k): {"count": int(v), "percent": _safe_pct(int(v), geo_total)}
                    for k, v in counts.items()
                },
            }

    if geo_result:
        results["geographic_distribution"] = geo_result

    # backward-compat key kept for existing callers
    if "district" in df.columns:
        counts = df["district"].value_counts(dropna=True)
        results["district_distribution"] = {str(k): int(v) for k, v in counts.items()}

    # ── Symptoms ──────────────────────────────────────────────────────────────
    symptom_cols = [c for c in df.columns if c.startswith("symptom_")]
    if symptom_cols:
        # Restrict to cases if case_status available
        base = df[df["case_status"] == 1] if "case_status" in df.columns else df
        n_base = len(base)
        symptom_summary: dict[str, Any] = {}
        for col in symptom_cols:
            name = col.replace("symptom_", "").replace("_", " ").title()
            count = int(base[col].sum()) if col in base.columns else 0
            symptom_summary[name] = {
                "count": count,
                "percent": _safe_pct(count, n_base),
            }
        results["symptoms"] = symptom_summary

    # ── Epicurve data (daily) ──────────────────────────────────────────────────
    if "date_onset" in df.columns:
        valid = df.dropna(subset=["date_onset"])
        if not valid.empty:
            daily = (
                valid.groupby(valid["date_onset"].dt.date)
                .size()
                .reset_index(name="count")
            )
            daily.columns = ["date", "count"]
            results["epicurve_daily"] = [
                {"date": str(r["date"]), "count": int(r["count"])}
                for _, r in daily.iterrows()
            ]

    # ── Epicurve data (weekly) ────────────────────────────────────────────────
    if "epiweek" in df.columns and "epiyear" in df.columns:
        valid = df.dropna(subset=["epiweek", "epiyear"])
        if not valid.empty:
            weekly = (
                valid.groupby(["epiyear", "epiweek"])
                .size()
                .reset_index(name="count")
            )
            results["epicurve_weekly"] = [
                {
                    "year": int(r["epiyear"]),
                    "week": int(r["epiweek"]),
                    "label": f"{int(r['epiyear'])}-W{int(r['epiweek']):02d}",
                    "count": int(r["count"]),
                }
                for _, r in weekly.iterrows()
            ]

    return results
