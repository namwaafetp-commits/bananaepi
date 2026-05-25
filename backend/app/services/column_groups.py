from __future__ import annotations

import pandas as pd

_INTERNAL = frozenset({
    "_quality_score", "_cleaning_status", "_duplicate_flag", "_flag_date_order",
})
_DERIVED = frozenset({
    "symptom_count", "exposure_count", "epiweek", "epiyear",
    "onset_datetime", "age_group",
})
_OUTCOME_COLS = frozenset({"outcome", "case_status", "meets_case_definition"})
_DEMOGRAPHIC_COLS = frozenset({"age", "sex", "nationality", "occupation"})
_TREATMENT_COLS = frozenset({
    "self_medicated", "self_resolved", "self_medication", "hospitalized",
})


def classify_columns(df: pd.DataFrame) -> dict[str, list[str]]:
    """
    Returns a stable column-group dict keyed by group name.
    Saved to project metadata after cleaning so every page reads from one place.
    """
    cols = set(df.columns)

    groups: dict[str, list[str]] = {
        "identity": sorted(c for c in cols if c == "case_id"),
        "time": sorted(
            c for c in cols
            if c.startswith(("date_", "time_")) and c not in _DERIVED
        ),
        "place": sorted(
            c for c in cols
            if c.startswith(("province", "district", "subdistrict", "village",
                              "place_", "address", "location"))
        ),
        "symptom_binary": sorted(
            c for c in cols
            if c.startswith("symptom_") and c not in _DERIVED
        ),
        "symptom_numeric": sorted(
            c for c in cols
            if any(kw in c for kw in ("times_per_day", "frequency", "temperature"))
            and not c.startswith("_")
            and c not in _DERIVED
        ),
        "exposure": sorted(
            c for c in cols
            if c.startswith("exposure_") and c not in _DERIVED
        ),
        "lab": sorted(
            c for c in cols
            if c.startswith("lab_") or c == "pathogen"
        ),
        "demographic": sorted(c for c in cols if c in _DEMOGRAPHIC_COLS),
        "underlying": sorted(c for c in cols if c.startswith("underlying_")),
        "outcome": sorted(c for c in cols if c in _OUTCOME_COLS),
        "treatment": sorted(
            c for c in cols
            if c.startswith("treatment_") or c in _TREATMENT_COLS
        ),
        "derived": sorted(c for c in cols if c in _DERIVED),
        "internal": sorted(c for c in cols if c in _INTERNAL or c.startswith("_")),
    }

    classified = {c for grp in groups.values() for c in grp}
    groups["other"] = sorted(c for c in cols if c not in classified)

    return groups
