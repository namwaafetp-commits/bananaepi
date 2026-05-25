"""
Analytic service: computes Risk Ratios (RR) or Odds Ratios (OR) with 95% CI and p-values
for all exposure_* columns against a binary outcome (case_status).

2x2 table layout:
              Case (1) | Non-case (0)
Exposed   (1)    a    |      b        n1 = a+b
Unexposed (0)    c    |      d        n2 = c+d

RR = (a/n1) / (c/n2)   — cohort / cross-sectional
OR = (a*d)  / (b*c)    — case-control or matched
95% CI (both): exp(ln(measure) ± 1.96 × SE_log)
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats


# ── Core RR computation ────────────────────────────────────────────────────────

def _compute_rr(a: int, b: int, c: int, d: int) -> dict[str, Any]:
    n1 = a + b  # total exposed
    n2 = c + d  # total unexposed

    if n1 == 0 or n2 == 0:
        return {"error": "Empty stratum in 2×2 table (n1 or n2 = 0)"}

    ar_exp = a / n1
    ar_unexp = c / n2

    # ── Risk Ratio ────────────────────────────────────────────────────────────
    if ar_unexp == 0:
        rr = ci_lower = ci_upper = None
    else:
        rr = ar_exp / ar_unexp
        # Haldane–Anscombe correction when a or c = 0
        a_c = a + 0.5 if a == 0 else a
        c_c = c + 0.5 if c == 0 else c
        n1_c = n1 + (0.5 if a == 0 else 0)
        n2_c = n2 + (0.5 if c == 0 else 0)
        try:
            se_log_rr = math.sqrt(
                (n1_c - a_c) / (a_c * n1_c) + (n2_c - c_c) / (c_c * n2_c)
            )
            log_rr = math.log(rr) if rr > 0 else None
            if log_rr is not None:
                ci_lower = math.exp(log_rr - 1.96 * se_log_rr)
                ci_upper = math.exp(log_rr + 1.96 * se_log_rr)
            else:
                ci_lower = ci_upper = None
        except (ValueError, ZeroDivisionError):
            ci_lower = ci_upper = None

    # ── Significance test ─────────────────────────────────────────────────────
    table = [[a, b], [c, d]]
    try:
        _, _, _, expected = stats.chi2_contingency(table, correction=False)
        if (np.array(expected) < 5).any():
            _, p_value = stats.fisher_exact(table)
            test_used = "Fisher's exact"
        else:
            chi2_stat, p_value, _, _ = stats.chi2_contingency(table, correction=False)
            test_used = "Chi-square"
    except Exception:
        p_value = None
        test_used = "N/A"

    return {
        "exposed_cases": a,
        "exposed_total": n1,
        "unexposed_cases": c,
        "unexposed_total": n2,
        "ar_exposed_pct": round(ar_exp * 100, 1),
        "ar_unexposed_pct": round(ar_unexp * 100, 1),
        "rr": round(rr, 2) if rr is not None else None,
        "ci_lower": round(ci_lower, 2) if ci_lower is not None else None,
        "ci_upper": round(ci_upper, 2) if ci_upper is not None else None,
        "p_value": round(float(p_value), 4) if p_value is not None else None,
        "test_used": test_used,
        "significant": bool(p_value < 0.05) if p_value is not None else None,
    }


# ── Core OR computation ────────────────────────────────────────────────────────

def _compute_or(a: int, b: int, c: int, d: int) -> dict[str, Any]:
    n1 = a + b
    n2 = c + d

    if n1 == 0 or n2 == 0:
        return {"error": "Empty stratum in 2×2 table (n1 or n2 = 0)"}

    ar_exp   = a / n1 if n1 else 0
    ar_unexp = c / n2 if n2 else 0

    # Haldane–Anscombe correction when any cell = 0
    a_c, b_c, c_c, d_c = (
        (a + 0.5, b + 0.5, c + 0.5, d + 0.5)
        if 0 in (a, b, c, d) else (a, b, c, d)
    )

    try:
        odds_ratio = (a_c * d_c) / (b_c * c_c)
        se_log_or  = math.sqrt(1/a_c + 1/b_c + 1/c_c + 1/d_c)
        log_or     = math.log(odds_ratio)
        ci_lower   = math.exp(log_or - 1.96 * se_log_or)
        ci_upper   = math.exp(log_or + 1.96 * se_log_or)
    except (ValueError, ZeroDivisionError):
        odds_ratio = ci_lower = ci_upper = None

    table = [[a, b], [c, d]]
    try:
        _, _, _, expected = stats.chi2_contingency(table, correction=False)
        if (np.array(expected) < 5).any():
            _, p_value = stats.fisher_exact(table)
            test_used = "Fisher's exact"
        else:
            _, p_value, _, _ = stats.chi2_contingency(table, correction=False)
            test_used = "Chi-square"
    except Exception:
        p_value = None
        test_used = "N/A"

    return {
        "exposed_cases": a,
        "exposed_total": n1,
        "unexposed_cases": c,
        "unexposed_total": n2,
        "ar_exposed_pct":   round(ar_exp   * 100, 1),
        "ar_unexposed_pct": round(ar_unexp * 100, 1),
        "rr":       round(odds_ratio, 2) if odds_ratio is not None else None,
        "ci_lower": round(ci_lower,   2) if ci_lower   is not None else None,
        "ci_upper": round(ci_upper,   2) if ci_upper   is not None else None,
        "p_value":  round(float(p_value), 4) if p_value is not None else None,
        "test_used": test_used,
        "significant": bool(p_value < 0.05) if p_value is not None else None,
    }


# ── Main entry point ───────────────────────────────────────────────────────────

def run_analytic(
    df: pd.DataFrame,
    outcome_col: str = "case_status",
    measure: str = "rr",
) -> dict[str, Any]:
    exposure_cols = [c for c in df.columns if c.startswith("exposure_")]

    if not exposure_cols:
        return {
            "error": "No exposure columns found (columns starting with 'exposure_')",
            "results": [],
        }

    if outcome_col not in df.columns:
        return {
            "error": (
                f"Outcome column '{outcome_col}' not found. "
                "Add a 'case_status' column: 1 = case, 0 = non-case."
            ),
            "results": [],
        }

    results: list[dict[str, Any]] = []

    for col in exposure_cols:
        label = col.replace("exposure_", "").replace("_", " ").title()

        valid = df[[col, outcome_col]].copy()
        valid[col] = pd.to_numeric(valid[col], errors="coerce")
        valid[outcome_col] = pd.to_numeric(valid[outcome_col], errors="coerce")
        valid = valid.dropna()
        valid = valid[valid[col].isin([0, 1]) & valid[outcome_col].isin([0, 1])]

        if len(valid) < 5:
            results.append({
                "exposure": label,
                "column": col,
                "error": f"Insufficient valid rows ({len(valid)}); need at least 5",
            })
            continue

        a = int(((valid[col] == 1) & (valid[outcome_col] == 1)).sum())
        b = int(((valid[col] == 1) & (valid[outcome_col] == 0)).sum())
        c = int(((valid[col] == 0) & (valid[outcome_col] == 1)).sum())
        d = int(((valid[col] == 0) & (valid[outcome_col] == 0)).sum())

        compute = _compute_or if measure == "or" else _compute_rr
        row = compute(a, b, c, d)
        row["exposure"] = label
        row["column"] = col
        results.append(row)

    # Sort: errors last, then by RR descending
    results.sort(
        key=lambda x: (
            "error" in x,
            -(x.get("rr") or 0),
        )
    )

    sig_count = sum(1 for r in results if r.get("significant"))

    return {
        "outcome_column": outcome_col,
        "measure": measure,
        "total_records": len(df),
        "exposures_analyzed": len(exposure_cols),
        "significant_exposures": sig_count,
        "results": results,
    }
