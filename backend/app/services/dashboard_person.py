import re
import pandas as pd
from app.services.dashboard_utils import get_analysis_population, calculate_attack_rate

_DEMO_VARS = ["sex", "age_group", "occupation", "nationality"]


def _age_sort_key(label: str) -> int:
    try:
        return int(re.split(r"[-–+]", str(label))[0])
    except (ValueError, IndexError):
        return 9999


def generate_person(df: pd.DataFrame, output_col: str = "met_case_def") -> dict:
    cases, _, _ = get_analysis_population(df, output_col)

    # ── Demographics ──────────────────────────────────────────────────────────
    demographics = {}
    demo_vars = [c for c in _DEMO_VARS if c in df.columns]

    for var in demo_vars:
        grp = (
            df.groupby(var, observed=True)
            .apply(
                lambda x: pd.Series({
                    "cases":   int((x[output_col] == 1.0).sum()),
                    "total":   len(x),
                })
            )
            .reset_index()
        )
        # Crude AR: cases / total in that group
        grp["attack_rate"] = grp.apply(
            lambda r: calculate_attack_rate(int(r["cases"]), int(r["total"])), axis=1
        )

        if var == "age_group":
            grp["_sort"] = grp["age_group"].apply(_age_sort_key)
            grp = grp.sort_values("_sort").drop(columns=["_sort"])
        else:
            grp = grp.sort_values("cases", ascending=False)

        grp = grp.reset_index(drop=True)
        demographics[var] = grp.to_dict(orient="records")

    # ── Symptoms ──────────────────────────────────────────────────────────────
    symptoms = []
    symptom_cols = [c for c in df.columns if c.startswith("symptom_") and c != "symptom_count"]
    if symptom_cols and not cases.empty:
        total_cases = len(cases)
        for col in symptom_cols:
            numeric = pd.to_numeric(cases[col], errors="coerce")
            count   = int(numeric.sum()) if not numeric.isna().all() else 0
            symptoms.append({
                "symptom":            col.replace("symptom_", "").replace("_", " ").title(),
                "cases_with_symptom": count,
                "percentage":         round(count / total_cases * 100, 1) if total_cases > 0 else 0,
            })
        symptoms.sort(key=lambda x: x["cases_with_symptom"], reverse=True)

    # ── Outcomes ─────────────────────────────────────────────────────────────
    outcomes = []
    outcome_cols = [c for c in ["treatment_opd", "treatment_ipd", "death", "self_medication"] if c in df.columns]
    if outcome_cols and not cases.empty:
        total_cases = len(cases)
        for col in outcome_cols:
            numeric = pd.to_numeric(cases[col], errors="coerce")
            count   = int(numeric.sum()) if not numeric.isna().all() else 0
            outcomes.append({
                "outcome":    col.replace("_", " ").title(),
                "cases":      count,
                "percentage": round(count / total_cases * 100, 1) if total_cases > 0 else 0,
            })

    return {
        "demographics": demographics,
        "symptoms":     symptoms,
        "outcomes":     outcomes,
    }
