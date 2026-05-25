"""Generate a data dictionary from the mapping and cleaning pipeline."""
from __future__ import annotations
from typing import Any
import pandas as pd

FIELD_META: dict[str, tuple[str, str]] = {
    "case_id":        ("identifier",  "Investigation case ID"),
    "record_id":      ("identifier",  "Unique row identifier"),
    "person_code":    ("identifier",  "Anonymous person code"),
    "sex":            ("demographic", "Sex of the case (Male/Female/Unknown)"),
    "age":            ("demographic", "Age value (raw numeric)"),
    "age_years":      ("demographic", "Age standardized in years"),
    "age_group":      ("demographic", "Age group — derived from age"),
    "occupation":     ("demographic", "Occupation"),
    "nationality":    ("demographic", "Nationality"),
    "date_onset":     ("time",        "Symptom onset date"),
    "time_onset":     ("time",        "Symptom onset time"),
    "onset_datetime": ("time",        "Onset date+time combined — derived"),
    "date_report":    ("time",        "Report date"),
    "date_admitted":  ("time",        "Hospital admission date"),
    "date_discharge": ("time",        "Hospital discharge date"),
    "date_exposure":  ("time",        "Date of suspected exposure"),
    "date_death":     ("time",        "Date of death"),
    "epiweek":        ("time",        "Epidemiologic week — derived from date_onset"),
    "epiyear":        ("time",        "Epidemiologic year — derived from date_onset"),
    "province":       ("location",    "Province"),
    "district":       ("location",    "District (Amphoe)"),
    "subdistrict":    ("location",    "Subdistrict (Tambon)"),
    "village":        ("location",    "Village"),
    "outcome":        ("clinical",    "Case outcome (Alive / Dead / Unknown)"),
    "hospitalized":   ("clinical",    "Hospitalized (1=yes, 0=no)"),
    "lab_result":     ("laboratory",  "Laboratory result (positive/negative/pending/unknown)"),
    "lab_confirmed":  ("laboratory",  "Laboratory confirmed case (1=yes, 0=no)"),
    "symptom_count":  ("clinical",    "Total symptom count — derived"),
    "exposure_count": ("exposure",    "Total exposure count — derived"),
}

VALUE_META: dict[str, dict] = {
    "sex":         {"Male": "Male", "Female": "Female", "Unknown": "Unknown or not recorded"},
    "outcome":     {"Alive": "Alive / recovered", "Dead": "Deceased", "Unknown": "Unknown"},
    "lab_result":  {"positive": "Pathogen detected", "negative": "Not detected",
                    "pending": "Awaiting result", "unknown": "Unknown"},
}
_BINARY_VALUES = {"1": "Yes / present / exposed", "0": "No / absent / not exposed"}


def build_data_dictionary(
    df_raw: pd.DataFrame,
    df_clean: pd.DataFrame,
    mapping_applied: dict[str, str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_clean: set[str] = set()

    for raw_col, clean_col in mapping_applied.items():
        if clean_col in ("skip", "keep") or not clean_col:
            continue
        if clean_col in seen_clean:
            continue
        seen_clean.add(clean_col)

        group, description = FIELD_META.get(clean_col, ("", ""))
        if not group:
            if clean_col.startswith("symptom_"):
                group, description = "symptom", f"Symptom: {clean_col[8:].replace('_', ' ')}"
            elif clean_col.startswith("exposure_"):
                group, description = "exposure", f"Exposure: {clean_col[9:].replace('_', ' ')}"
            elif clean_col.startswith("underlying_"):
                group, description = "risk_factor", f"Underlying: {clean_col[11:].replace('_', ' ')}"
            elif clean_col.startswith("time_"):
                group, description = "time", f"Time: {clean_col[5:].replace('_', ' ')}"
            else:
                group, description = "other", ""

        value_map = VALUE_META.get(clean_col, {})
        if not value_map and (
            clean_col.startswith("symptom_") or clean_col.startswith("exposure_")
            or clean_col in ("hospitalized", "lab_confirmed", "vaccinated")
        ):
            value_map = _BINARY_VALUES

        example_vals: list[str] = []
        if clean_col in df_clean.columns:
            example_vals = df_clean[clean_col].dropna().astype(str).unique()[:6].tolist()

        missing_pct = 0.0
        if raw_col in df_raw.columns:
            missing_pct = round(df_raw[raw_col].isna().sum() / max(len(df_raw), 1) * 100, 1)

        rows.append({
            "original_column":      raw_col,
            "clean_column":         clean_col,
            "data_group":           group,
            "description":          description,
            "cleaning_method":      "python_rule_based",
            "value_mapping":        value_map,
            "example_clean_values": example_vals,
            "missing_pct_raw":      missing_pct,
        })

    # Append derived columns not in mapping
    for derived in ["age_group", "epiweek", "epiyear", "symptom_count",
                     "exposure_count", "onset_datetime", "age_years"]:
        if derived in df_clean.columns and derived not in seen_clean:
            group, description = FIELD_META.get(derived, ("derived", f"Derived: {derived}"))
            example_vals = df_clean[derived].dropna().astype(str).unique()[:6].tolist()
            rows.append({
                "original_column":    "(derived)",
                "clean_column":       derived,
                "data_group":         group or "derived",
                "description":        description,
                "cleaning_method":    "python_derived",
                "value_mapping":      {},
                "example_clean_values": example_vals,
                "missing_pct_raw":    0.0,
            })

    return rows
