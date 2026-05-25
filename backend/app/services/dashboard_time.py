import re
from datetime import timedelta
import pandas as pd
from app.services.dashboard_utils import get_analysis_population

_PAD_DAYS  = 3
_PAD_WEEKS = 2
_PAD_HOURS = 3   # padding on each side for hourly view

_SKIP_COLS = {
    "date_onset", "date_report", "date_admitted", "date_outcome", "date_death",
    "case_id", "id", "epiweek", "epiyear",
    "incubation_days", "reporting_delay_days", "length_of_stay_days",
}
_PRIORITY = ["sex", "age_group", "district", "village", "school", "ward", "subdistrict"]


def _iso_week_label(d) -> str:
    iso = d.isocalendar()
    return f"W{iso[1]:02d}/{iso[0]}"


def _age_sort_key(label: str) -> int:
    """Sort age-group labels numerically by their leading number."""
    try:
        return int(re.split(r"[-–+–]", str(label))[0])
    except (ValueError, IndexError):
        return 9999


def _sort_categories(col_name: str, categories: list) -> list:
    if col_name == "age_group" or all(re.match(r"^\d", str(c)) for c in categories if c != "Unknown"):
        return sorted(categories, key=_age_sort_key)
    return sorted(categories)


def _stack_candidates(cases: pd.DataFrame, output_col: str) -> list[str]:
    skip = _SKIP_COLS | {output_col}
    cols = []
    for col in cases.columns:
        if col in skip:
            continue
        if col.startswith(("exposure_", "symptom_", "lab_", "date_")):
            continue
        n = cases[col].dropna().nunique()
        if 2 <= n <= 10:
            cols.append(col)
    cols.sort(key=lambda c: _PRIORITY.index(c) if c in _PRIORITY else len(_PRIORITY))
    return cols[:6]


def _build_stacked(cases_dated: pd.DataFrame, group_col: str, full_dates: list[str]):
    df = cases_dated.copy()
    df["_g"]    = df[group_col].fillna("Unknown").astype(str)
    df["_date"] = df["date_onset"].dt.strftime("%Y-%m-%d")

    categories = _sort_categories(group_col, df["_g"].unique().tolist())

    pivot = (
        df.groupby(["_date", "_g"])
        .size()
        .unstack(fill_value=0)
        .reindex(full_dates, fill_value=0)
    )
    for cat in categories:
        if cat not in pivot.columns:
            pivot[cat] = 0

    rows = []
    for date_str in pivot.index:
        row = {"date": date_str}
        for cat in categories:
            row[cat] = int(pivot.loc[date_str, cat])
        rows.append(row)
    return rows, categories


def _has_time_info(series: pd.Series) -> bool:
    """True if any timestamp has a non-midnight time component."""
    if series.empty:
        return False
    return not (series.dt.normalize() == series).all()


def _build_hourly_curve(cases_dated: pd.DataFrame) -> list[dict]:
    """Return 1-hour bucket counts with _PAD_HOURS padding on each side."""
    dt = cases_dated["date_onset"]
    first_h = dt.min().floor("h") - pd.Timedelta(hours=_PAD_HOURS)
    last_h  = dt.max().floor("h") + pd.Timedelta(hours=_PAD_HOURS)

    all_hours = pd.date_range(first_h, last_h, freq="h").strftime("%Y-%m-%d %H:%M").tolist()

    counts = (
        dt.dt.floor("h").dt.strftime("%Y-%m-%d %H:%M")
        .value_counts()
        .reindex(all_hours, fill_value=0)
    )
    cum = 0
    result = []
    for label, count in counts.items():
        cum += int(count)
        result.append({"datetime": label, "case_count": int(count), "cumulative": cum})
    return result


def generate_time(df: pd.DataFrame, output_col: str = "met_case_def") -> dict:
    cases, _, _ = get_analysis_population(df, output_col)

    _empty = {
        "first_onset": None, "peak_onset": None, "last_onset": None,
        "duration_days": None, "cases_missing_date": 0,
        "has_time": False,
        "epi_curve": [], "epi_curve_hourly": [], "epi_curve_weekly": [],
        "stack_options": [], "stacked_by": {},
    }

    if cases.empty or "date_onset" not in df.columns:
        return _empty

    cases_dated   = cases.dropna(subset=["date_onset"]).copy()
    missing_dates = len(cases) - len(cases_dated)

    if cases_dated.empty:
        return {**_empty, "cases_missing_date": missing_dates}

    cases_dated["date_onset"] = pd.to_datetime(cases_dated["date_onset"])

    first_onset = cases_dated["date_onset"].min()
    last_onset  = cases_dated["date_onset"].max()
    duration    = (last_onset - first_onset).days + 1

    # ── Daily epi curve (padded) ──────────────────────────────────────────────
    padded_start = first_onset - timedelta(days=_PAD_DAYS)
    padded_end   = last_onset  + timedelta(days=_PAD_DAYS)
    full_dates   = pd.date_range(padded_start, padded_end).strftime("%Y-%m-%d").tolist()

    daily = (
        cases_dated["date_onset"]
        .dt.strftime("%Y-%m-%d")
        .value_counts()
        .reindex(full_dates, fill_value=0)
    )
    cumulative = 0
    epi_curve  = []
    for date_str, count in daily.items():
        cumulative += int(count)
        epi_curve.append({"date": date_str, "case_count": int(count), "cumulative": cumulative})

    peak_onset = daily[
        full_dates.index(first_onset.strftime("%Y-%m-%d")):
        full_dates.index(last_onset.strftime("%Y-%m-%d")) + 1
    ].idxmax()

    # ── Hourly epi curve (only if timestamps carry time info) ─────────────────
    has_time       = _has_time_info(cases_dated["date_onset"])
    epi_curve_hourly: list[dict] = _build_hourly_curve(cases_dated) if has_time else []

    # ── Weekly curve (padded) ─────────────────────────────────────────────────
    epi_curve_weekly: list[dict] = []
    if "epiweek" in cases_dated.columns and "epiyear" in cases_dated.columns:
        wk = (
            cases_dated
            .dropna(subset=["epiweek", "epiyear"])
            .assign(
                epiweek=lambda x: pd.to_numeric(x["epiweek"], errors="coerce"),
                epiyear=lambda x: pd.to_numeric(x["epiyear"], errors="coerce"),
            )
            .dropna(subset=["epiweek", "epiyear"])
        )
        if not wk.empty:
            wk["week_label"] = wk.apply(
                lambda r: f"W{int(r['epiweek']):02d}/{int(r['epiyear'])}", axis=1
            )
            weekly_counts = wk.groupby("week_label").size().reset_index(name="case_count")
            outbreak_rows = [
                {"week": row["week_label"], "case_count": int(row["case_count"])}
                for _, row in weekly_counts.iterrows()
            ]
            pad_before = [
                {"week": _iso_week_label((first_onset - timedelta(weeks=_PAD_WEEKS - i)).to_pydatetime()), "case_count": 0}
                for i in range(_PAD_WEEKS)
            ]
            pad_after = [
                {"week": _iso_week_label((last_onset + timedelta(weeks=i + 1)).to_pydatetime()), "case_count": 0}
                for i in range(_PAD_WEEKS)
            ]
            cum = 0
            for row in pad_before + outbreak_rows + pad_after:
                cum += row["case_count"]
                epi_curve_weekly.append({**row, "cumulative": cum})

    # ── Stacked curves ────────────────────────────────────────────────────────
    stack_options    = _stack_candidates(cases_dated, output_col)
    stacked_by       = {}
    stack_categories = {}          # authoritative sorted category order per column
    for col in stack_options:
        rows, cats = _build_stacked(cases_dated, col, full_dates)
        stacked_by[col]       = rows
        stack_categories[col] = cats  # already sorted young→old for age_group

    return {
        "first_onset":        first_onset.strftime("%Y-%m-%d"),
        "peak_onset":         peak_onset,
        "last_onset":         last_onset.strftime("%Y-%m-%d"),
        "duration_days":      int(duration),
        "cases_missing_date": missing_dates,
        "has_time":           has_time,
        "epi_curve":          epi_curve,
        "epi_curve_hourly":   epi_curve_hourly,
        "epi_curve_weekly":   epi_curve_weekly,
        "stack_options":      stack_options,
        "stacked_by":         stacked_by,
        "stack_categories":   stack_categories,
    }
