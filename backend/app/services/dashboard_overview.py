from datetime import date as _date
import pandas as pd
from app.services.dashboard_utils import (
    get_analysis_population,
    calculate_attack_rate,
    calculate_2x2_table,
    calculate_rr,
)

_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _fmt_date(date_str: str) -> str:
    if not date_str:
        return "an unknown date"
    try:
        d = _date.fromisoformat(date_str)
        return f"{d.day} {_MONTHS[d.month - 1]} {d.year}"
    except Exception:
        return date_str


def _build_summary(d: dict) -> str:
    sentences: list[str] = []

    # ── Para 1: scale + attack rate ───────────────────────────────────────────
    sentences.append(
        f"A total of {d['total_records']} persons were investigated, of whom "
        f"{d['case_count']} met the case definition "
        f"(crude attack rate: {d['attack_rate']}%)."
    )

    # ── Para 2: outbreak period ───────────────────────────────────────────────
    if d["first_onset"] and d["last_onset"] and d["outbreak_duration_days"] is not None:
        dur = d["outbreak_duration_days"]
        day_word = "day" if dur == 1 else "days"
        peak_clause = (
            f", with the peak on {_fmt_date(d['peak_onset_date'])}"
            if d["peak_onset_date"] else ""
        )
        sentences.append(
            f"The outbreak spanned {dur} {day_word} "
            f"({_fmt_date(d['first_onset'])} to {_fmt_date(d['last_onset'])})"
            f"{peak_clause}."
        )

    # ── Para 3: age ───────────────────────────────────────────────────────────
    if d["median_age"] is not None:
        iqr_clause = ""
        if d["age_q1"] is not None and d["age_q3"] is not None:
            iqr_clause = f" (IQR: {d['age_q1']:.1f}–{d['age_q3']:.1f} years)"
        sentences.append(
            f"The median age of cases was {d['median_age']:.0f} years{iqr_clause}."
        )

    # ── Para 4: clinical outcomes ─────────────────────────────────────────────
    clinical: list[str] = []
    if d["hospitalized_count"] is not None:
        rate_clause = (
            f" (admission rate: {d['hospitalization_rate']}%)"
            if d["hospitalization_rate"] is not None else ""
        )
        clinical.append(f"{d['hospitalized_count']} case(s) were hospitalised{rate_clause}")
    if d["death_count"] is not None and d["death_count"] > 0:
        clinical.append(f"{d['death_count']} death(s) were recorded")
    if d["lab_positive_count"] is not None:
        pct_clause = (
            f" ({d['lab_positive_pct']}% of cases)"
            if d["lab_positive_pct"] is not None else ""
        )
        clinical.append(f"{d['lab_positive_count']} case(s) were laboratory-confirmed{pct_clause}")
    if clinical:
        sentences.append("; ".join(clinical).capitalize() + ".")

    # ── Para 5: symptom ───────────────────────────────────────────────────────
    if d["most_common_symptom"]:
        sentences.append(
            f"The most frequently reported symptom among cases was "
            f"{d['most_common_symptom'].lower()}."
        )

    # ── Para 6: exposure ─────────────────────────────────────────────────────
    if d["top_exposure_signal"]:
        sentences.append(
            f"Epidemiological analysis identified "
            f"{d['top_exposure_signal'].lower()} as the leading exposure risk factor "
            f"(statistically significant, p < 0.05)."
        )

    return "  ".join(sentences)


def generate_overview(df: pd.DataFrame, output_col: str = "met_case_def") -> dict:
    total_records = len(df)
    cases, non_cases, unknown = get_analysis_population(df, output_col)

    case_count     = len(cases)
    non_case_count = len(non_cases)
    unknown_count  = len(unknown)
    attack_rate    = calculate_attack_rate(case_count, total_records)

    # ── Onset dates ───────────────────────────────────────────────────────────
    peak_onset_date        = None
    first_onset            = None
    last_onset             = None
    outbreak_duration_days = None
    if "date_onset" in df.columns and not cases.empty:
        onset_series = pd.to_datetime(cases["date_onset"], errors="coerce").dropna()
        if not onset_series.empty:
            counts                 = onset_series.dt.date.value_counts()
            peak_onset_date        = str(counts.idxmax())
            first_onset            = str(onset_series.min().date())
            last_onset             = str(onset_series.max().date())
            outbreak_duration_days = int((onset_series.max() - onset_series.min()).days)

    # ── Optional clinical counts ──────────────────────────────────────────────
    hospitalized_count   = None
    hospitalization_rate = None
    if "hospitalized" in df.columns and not cases.empty:
        hosp = pd.to_numeric(cases["hospitalized"], errors="coerce")
        if not hosp.isna().all():
            hospitalized_count   = int(hosp.sum())
            hospitalization_rate = calculate_attack_rate(hospitalized_count, case_count)

    death_count = None
    for death_col in ("death", "date_death", "outcome"):
        if death_col in df.columns and not cases.empty:
            if death_col == "date_death":
                parsed = pd.to_datetime(cases[death_col], errors="coerce")
                death_count = int(parsed.notna().sum()) if not parsed.isna().all() else None
            elif death_col == "outcome":
                death_count = int(
                    cases[death_col].astype(str).str.lower().isin(
                        {"dead", "death", "died", "deceased"}
                    ).sum()
                )
            else:
                val = pd.to_numeric(cases[death_col], errors="coerce")
                death_count = int(val.sum()) if not val.isna().all() else None
            break

    lab_positive_count = None
    lab_positive_pct   = None
    for lab_col in ("lab_confirmed", "lab_result", "lab_positive"):
        if lab_col in df.columns and not cases.empty:
            if lab_col == "lab_confirmed":
                val = pd.to_numeric(cases[lab_col], errors="coerce")
                if not val.isna().all():
                    lab_positive_count = int(val.sum())
            else:
                lab_positive_count = int(
                    cases[lab_col].astype(str).str.lower().isin(
                        {"positive", "pos", "detected", "1", "true"}
                    ).sum()
                )
            if lab_positive_count is not None and case_count > 0:
                lab_positive_pct = calculate_attack_rate(lab_positive_count, case_count)
            break

    # ── Median age + IQR ─────────────────────────────────────────────────────
    median_age = None
    age_q1     = None
    age_q3     = None
    if "age" in df.columns and not cases.empty:
        ages = pd.to_numeric(cases["age"], errors="coerce").dropna()
        if not ages.empty:
            median_age = float(ages.median())
            age_q1     = float(ages.quantile(0.25))
            age_q3     = float(ages.quantile(0.75))

    # ── Most common symptom ───────────────────────────────────────────────────
    most_common_symptom = None
    symptom_cols = [c for c in df.columns if c.startswith("symptom_") and c != "symptom_count"]
    if symptom_cols and not cases.empty:
        symp_num = cases[symptom_cols].apply(pd.to_numeric, errors="coerce")
        sym_counts = symp_num.sum()
        if sym_counts.max() > 0:
            most_common_symptom = (
                sym_counts.idxmax().replace("symptom_", "").replace("_", " ").title()
            )

    # ── Top exposure signal ───────────────────────────────────────────────────
    top_exposure = None
    best_rr = 0
    exposure_cols = [c for c in df.columns if c.startswith("exposure_") and c != "exposure_count"]
    for col in exposure_cols:
        tb = calculate_2x2_table(df, col, output_col)
        if not tb:
            continue
        rr, _, _, p, _ = calculate_rr(
            tb["cases_exposed"], tb["controls_exposed"],
            tb["cases_unexposed"], tb["controls_unexposed"],
        )
        if rr and rr != float("inf") and p is not None and p < 0.05 and rr > best_rr:
            best_rr = rr
            top_exposure = col.replace("exposure_", "").replace("_", " ").title()

    result = {
        "total_records":          total_records,
        "case_count":             case_count,
        "non_case_count":         non_case_count,
        "unknown_count":          unknown_count,
        "attack_rate":            attack_rate,
        "peak_onset_date":        peak_onset_date,
        "first_onset":            first_onset,
        "last_onset":             last_onset,
        "outbreak_duration_days": outbreak_duration_days,
        "hospitalized_count":     hospitalized_count,
        "hospitalization_rate":   hospitalization_rate,
        "death_count":            death_count,
        "lab_positive_count":     lab_positive_count,
        "lab_positive_pct":       lab_positive_pct,
        "median_age":             median_age,
        "age_q1":                 age_q1,
        "age_q3":                 age_q3,
        "most_common_symptom":    most_common_symptom,
        "top_exposure_signal":    top_exposure,
    }
    result["summary"] = _build_summary(result)
    return result
