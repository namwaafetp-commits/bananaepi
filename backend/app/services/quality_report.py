"""Compute a dataset-level quality report after cleaning."""
from __future__ import annotations

import pandas as pd
import numpy as np


def compute_quality_report(df_raw: pd.DataFrame, df_clean: pd.DataFrame, cleaning_stats: dict) -> dict:
    """Return a structured quality report comparing raw vs cleaned dataframe."""
    n = len(df_clean)
    if n == 0:
        return {"error": "Empty dataframe"}

    # ── Completeness per column ──────────────────────────────────────────────
    completeness: dict[str, dict] = {}
    for col in df_raw.columns:
        if col.startswith("_"):
            continue
        raw_miss = int(df_raw[col].isna().sum())
        clean_miss = int(df_clean[col].isna().sum()) if col in df_clean.columns else raw_miss
        completeness[col] = {
            "raw_missing": raw_miss,
            "clean_missing": clean_miss,
            "raw_pct": round(raw_miss / len(df_raw) * 100, 1),
            "clean_pct": round(clean_miss / n * 100, 1),
            "improved": clean_miss < raw_miss,
        }

    # ── Quality tier counts ──────────────────────────────────────────────────
    tiers: dict[str, int] = {
        "clean": int((df_clean.get("_cleaning_status", pd.Series()) == "clean").sum()),
        "needs_review": int((df_clean.get("_cleaning_status", pd.Series()) == "needs_review").sum()),
        "excluded": int((df_clean.get("_cleaning_status", pd.Series()) == "excluded").sum()),
    }

    # ── Score distribution ────────────────────────────────────────────────────
    score_col = df_clean.get("_quality_score")
    score_stats: dict = {}
    if score_col is not None and len(score_col) > 0:
        score_stats = {
            "mean": round(float(score_col.mean()), 1),
            "median": round(float(score_col.median()), 1),
            "min": int(score_col.min()),
            "max": int(score_col.max()),
            "pct_above_80": round((score_col >= 80).sum() / n * 100, 1),
        }

    # ── Duplicate summary ─────────────────────────────────────────────────────
    dup_col = df_clean.get("_duplicate_flag")
    n_dups = int(dup_col.sum()) if dup_col is not None else 0

    # ── Date columns parsed ────────────────────────────────────────────────────
    date_cols = cleaning_stats.get("date_columns_parsed", [])
    date_summary: dict[str, dict] = {}
    for col in date_cols:
        if col in df_clean.columns:
            valid = df_clean[col].notna().sum()
            date_summary[col] = {
                "parsed_count": int(valid),
                "missing_count": int(n - valid),
                "pct_valid": round(valid / n * 100, 1),
            }

    # ── Overall dataset score (weighted average of completeness + quality) ────
    key_fields = [c for c in ["case_id", "date_onset", "age", "sex"] if c in completeness]
    if key_fields:
        key_complete = np.mean([100 - completeness[c]["clean_pct"] for c in key_fields])
    else:
        key_complete = 100.0

    quality_avg = cleaning_stats.get("quality_avg", score_stats.get("mean", 50))
    dataset_score = round((key_complete * 0.5 + quality_avg * 0.5), 1)

    return {
        "dataset_score": dataset_score,
        "total_rows": n,
        "tiers": tiers,
        "score_stats": score_stats,
        "duplicates_flagged": n_dups,
        "completeness": completeness,
        "date_columns": date_summary,
        "cleaning_actions": cleaning_stats.get("actions", []),
        "symptom_columns": cleaning_stats.get("symptom_columns", []),
        "exposure_columns": cleaning_stats.get("exposure_columns", []),
    }
