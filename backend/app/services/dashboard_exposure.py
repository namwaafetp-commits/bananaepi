import pandas as pd
from app.services.dashboard_utils import calculate_2x2_table, calculate_rr


def generate_exposure(df: pd.DataFrame, output_col: str = "met_case_def") -> dict:
    exposure_cols = [c for c in df.columns if c.startswith("exposure_") and c != "exposure_count"]

    results = []
    for col in exposure_cols:
        tb = calculate_2x2_table(df, col, output_col)
        if not tb:
            continue

        ar_exp   = round(tb["cases_exposed"]   / tb["total_exposed"]   * 100, 1) if tb["total_exposed"]   > 0 else 0.0
        ar_unexp = round(tb["cases_unexposed"] / tb["total_unexposed"] * 100, 1) if tb["total_unexposed"] > 0 else 0.0

        rr, ci_lo, ci_hi, p_val, test_used = calculate_rr(
            tb["cases_exposed"], tb["controls_exposed"],
            tb["cases_unexposed"], tb["controls_unexposed"],
        )

        flags = []
        if (tb["cases_exposed"] < 5 or tb["cases_unexposed"] < 5
                or tb["controls_exposed"] < 5 or tb["controls_unexposed"] < 5):
            flags.append("small_cells")

        missing = len(df) - (tb["total_exposed"] + tb["total_unexposed"])
        if len(df) > 0 and missing / len(df) > 0.2:
            flags.append("high_missingness")

        def _fmt_p(p):
            if p is None:
                return None
            if p < 0.001:
                return "<0.001"
            return round(p, 3)

        results.append({
            "exposure":     col.replace("exposure_", "").replace("_", " ").title(),
            "column_name":  col,
            "table":        tb,
            "ar_exposed":   ar_exp,
            "ar_unexposed": ar_unexp,
            "ar_diff":      round(ar_exp - ar_unexp, 1),
            "rr":           rr if rr is not None and rr != float("inf") else None,
            "rr_ci_lower":  ci_lo,
            "rr_ci_upper":  ci_hi,
            "p_value":      _fmt_p(p_val),
            "test_used":    test_used,
            "missing_count": missing,
            "flags":        flags,
        })

    results.sort(key=lambda x: x["ar_diff"], reverse=True)

    return {"exposures": results}
