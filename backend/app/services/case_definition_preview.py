import pandas as pd
from app.services.case_definition_evaluator import apply_case_definition
import math

_SYMPTOM_TYPES = frozenset({
    "symptom_any", "symptom_all", "symptom_n_of_m", "symptom_binary", "numeric_symptom",
})


def _scan_rules(rules: list) -> dict:
    """Recursively scan rule list and return flags for which groups are present."""
    flags = {"time": False, "place": False, "lab": False, "symptom": False}
    for r in rules:
        if not r.get("enabled", True):
            continue
        t = r.get("type", "")
        if t == "time":
            flags["time"] = True
        elif t in ("place", "place_group"):
            flags["place"] = True
        elif t in ("lab", "lab_group"):
            flags["lab"] = True
        elif t in _SYMPTOM_TYPES:
            flags["symptom"] = True
        if "rules" in r:
            sub = _scan_rules(r["rules"])
            for k in flags:
                flags[k] = flags[k] or sub[k]
    return flags


def generate_preview(df: pd.DataFrame, rule_json: dict, output_col: str = "met_case_def"):
    errors   = []
    warnings = []

    # ── Validate mandatory criteria ───────────────────────────────────────────
    enabled_rules = [r for r in rule_json.get("rules", []) if r.get("enabled", True)]
    if not enabled_rules:
        errors.append("No criteria defined. Add at least one symptom criterion to continue.")
        return {"summary": {}, "errors": errors, "warnings": [], "preview_rows": []}

    flags = _scan_rules(enabled_rules)

    if not flags["symptom"]:
        errors.append(
            "Symptom criteria are mandatory. "
            "Add at least one symptom rule (symptom_any, symptom_all, symptom_n_of_m, or numeric_symptom)."
        )
        return {"summary": {}, "errors": errors, "warnings": [], "preview_rows": []}

    # ── Optional-criteria warnings ────────────────────────────────────────────
    if not flags["time"]:
        warnings.append("No time criteria. This may include cases outside the outbreak period.")
    if not flags["place"]:
        warnings.append("No place criteria. This may include cases outside the investigation setting.")
    if not flags["lab"]:
        warnings.append("This definition does not require laboratory confirmation.")

    # ── Evaluate ──────────────────────────────────────────────────────────────
    df_eval = df.copy()
    df_eval = apply_case_definition(df_eval, rule_json, output_col=output_col)

    total         = len(df_eval)
    case_count    = (df_eval["case_def_status"] == "case").sum()
    non_case_count = (df_eval["case_def_status"] == "non_case").sum()

    summary = {
        "total_rows":      int(total),
        "case_count":      int(case_count),
        "non_case_count":  int(non_case_count),
        "case_percent":    float(round((case_count / total * 100) if total > 0 else 0, 1)),
        "non_case_percent": float(round((non_case_count / total * 100) if total > 0 else 0, 1)),
        "missing_field_summary": [],
    }

    # ── Sample preview rows ───────────────────────────────────────────────────
    preview_rows = []
    for status in ["case", "non_case"]:
        sample = df_eval[df_eval["case_def_status"] == status].head(3)
        for _, row in sample.iterrows():
            preview_rows.append({
                "record_id":    str(row.get("case_id", "")),
                "case_status":  status,
                "met_case_def": int(row[output_col]) if pd.notna(row[output_col]) else 0,
                "reason":       row["case_def_reason"],
            })

    return {
        "summary":      summary,
        "errors":       errors,
        "warnings":     warnings,
        "preview_rows": preview_rows,
    }
