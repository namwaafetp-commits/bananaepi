import pandas as pd
from app.services.dashboard_utils import get_analysis_population, calculate_attack_rate

_PLACE_COLS = ["province", "district", "subdistrict", "village", "ward", "department", "class", "school"]


def generate_place(df: pd.DataFrame, output_col: str = "met_case_def") -> dict:
    place_vars = [c for c in _PLACE_COLS if c in df.columns]

    if not place_vars:
        return {"available_variables": [], "tables": {}}

    tables = {}
    for var in place_vars:
        grp = (
            df.groupby(var, observed=True)
            .apply(
                lambda x: pd.Series({
                    "cases":     int((x[output_col] == 1.0).sum()),
                    "non_cases": int((x[output_col] == 0.0).sum()),
                    "unknown":   int(x[output_col].isna().sum()),
                    "total":     len(x),
                })
            )
            .reset_index()
        )

        # Crude AR: cases / total investigated in that group
        grp["attack_rate"] = grp.apply(
            lambda r: calculate_attack_rate(int(r["cases"]), int(r["total"])), axis=1
        )

        # Sort by attack rate descending
        grp = grp.sort_values("attack_rate", ascending=False).reset_index(drop=True)

        tables[var] = grp.to_dict(orient="records")

    return {
        "available_variables": place_vars,
        "tables": tables,
    }
