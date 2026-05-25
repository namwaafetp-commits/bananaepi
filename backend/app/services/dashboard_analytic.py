import pandas as pd
from app.services.dashboard_utils import calculate_2x2_table, calculate_rr


def generate_analytic(df: pd.DataFrame, output_col: str = "met_case_def") -> dict:
    exposure_cols = [c for c in df.columns if c.startswith("exposure_") and c != "exposure_count"]

    results = []
    for col in exposure_cols:
        tb = calculate_2x2_table(df, col, output_col)
        if not tb:
            continue

        rr, ci_lower, ci_upper, p_val, test_used = calculate_rr(
            tb["cases_exposed"], tb["controls_exposed"],
            tb["cases_unexposed"], tb["controls_unexposed"],
        )

        flags = []
        if p_val is not None and p_val < 0.05:
            flags.append("significant")
        if (tb["cases_exposed"] < 5 or tb["cases_unexposed"] < 5
                or tb["controls_exposed"] < 5 or tb["controls_unexposed"] < 5):
            flags.append("small_cells")

        ar_exp   = round(tb["cases_exposed"]   / tb["total_exposed"]   * 100, 1) if tb["total_exposed"]   > 0 else 0.0
        ar_unexp = round(tb["cases_unexposed"] / tb["total_unexposed"] * 100, 1) if tb["total_unexposed"] > 0 else 0.0

        results.append({
            "exposure":    col.replace("exposure_", "").replace("_", " ").title(),
            "column_name": col,
            "table":       tb,
            "ar_exposed":  ar_exp,
            "ar_unexposed": ar_unexp,
            "measure":     "RR",
            "estimate":    rr if rr is not None and rr != float("inf") else None,
            "ci_lower":    ci_lower,
            "ci_upper":    ci_upper,
            "p_value":     p_val,
            "test_used":   test_used,
            "flags":       flags,
        })

    results.sort(
        key=lambda x: x["estimate"] if x["estimate"] is not None else -1,
        reverse=True,
    )

    return {"results": results}
