import json
import pandas as pd
from app.config import SCHEMA_PATH


def load_schema() -> dict:
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


def validate_dataframe(df: pd.DataFrame) -> dict:
    """
    Soft-validation after column mapping.
    Returns warnings (not hard errors) so the pipeline never blocks.
    """
    schema = load_schema()
    warnings: list[str] = []

    # ── Required fields from new hierarchical schema ──────────────────────────
    required = [
        fid
        for cat in schema["categories"].values()
        for fid, f in cat["fields"].items()
        if f.get("required")
    ]
    missing_required = [f for f in required if f not in df.columns]
    if missing_required:
        warnings.append(
            f"Missing recommended standard columns (map them for full analysis): {missing_required}"
        )

    # ── Exposure / symptom columns ────────────────────────────────────────────
    exposure_cols = [c for c in df.columns if c.startswith("exposure_")]
    symptom_cols  = [c for c in df.columns if c.startswith("symptom_")]

    if not exposure_cols:
        warnings.append(
            "No exposure_ columns found. Analytic (RR) analysis will be unavailable."
        )

    if "case_status" not in df.columns:
        warnings.append(
            "No 'case_status' column (1=case, 0=non-case). RR requires both cases and controls."
        )

    # ── Value-level checks ────────────────────────────────────────────────────
    if "sex" in df.columns:
        valid_sex = {"male", "female", "unknown", "m", "f", "u", ""}
        bad_vals = (
            df["sex"].dropna().astype(str).str.lower()
            .pipe(lambda s: s[~s.isin(valid_sex)].unique().tolist())
        )
        if bad_vals:
            warnings.append(
                f"Non-standard 'sex' values (will be set to Unknown): {bad_vals[:5]}"
            )

    if "outcome" in df.columns:
        valid_outcomes = {
            "alive", "dead", "unknown", "deceased", "recovered",
            "survived", "death", "died", "0", "1", "",
        }
        bad_vals = (
            df["outcome"].dropna().astype(str).str.lower()
            .pipe(lambda s: s[~s.isin(valid_outcomes)].unique().tolist())
        )
        if bad_vals:
            warnings.append(
                f"Non-standard 'outcome' values (will be mapped to Unknown): {bad_vals[:5]}"
            )

    if "case_id" in df.columns:
        dupes = int(df["case_id"].duplicated().sum())
        if dupes:
            warnings.append(f"{dupes} duplicate case_id values found.")

    return {
        "valid": True,          # never blocks — warnings only
        "errors": [],
        "warnings": warnings,
        "exposure_columns": exposure_cols,
        "symptom_columns": symptom_cols,
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": list(df.columns),
    }
