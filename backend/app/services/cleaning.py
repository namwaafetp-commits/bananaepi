from __future__ import annotations

import re
import pandas as pd
import numpy as np
from datetime import datetime

# ── Missing value sentinel strings ────────────────────────────────────────────
MISSING_STRS = {
    "", " ", "-", "--", "---", "na", "n/a", "nan", "none", "null",
    "ไม่ทราบ", "ไม่ระบุ", "ไม่มีข้อมูล", "ไม่ได้ระบุ", "ข้อมูลไม่ครบ",
    "unknown", "missing", ".", "..",
}

# ── Sex mapping (Thai + English abbreviations) ────────────────────────────────
SEX_MAP = {
    "ชาย": "Male", "ช": "Male", "ช.": "Male",
    "m": "Male", "male": "Male", "man": "Male", "boy": "Male",
    "1": "Male",
    "หญิง": "Female", "ญ": "Female", "ญ.": "Female",
    "f": "Female", "female": "Female", "woman": "Female", "girl": "Female",
    "2": "Female",
    "u": "Unknown", "unknown": "Unknown", "other": "Unknown",
    "ไม่ทราบ": "Unknown", "ไม่ระบุ": "Unknown",
}

# ── Outcome mapping ────────────────────────────────────────────────────────────
OUTCOME_MAP = {
    "มีชีวิต": "Alive", "รอด": "Alive", "หายแล้ว": "Alive",
    "alive": "Alive", "survived": "Alive", "recovered": "Alive",
    "living": "Alive", "discharged": "Alive", "0": "Alive",
    "เสียชีวิต": "Dead", "ตาย": "Dead", "เสีย": "Dead",
    "dead": "Dead", "died": "Dead", "deceased": "Dead",
    "death": "Dead", "expired": "Dead", "1": "Dead",
    "unknown": "Unknown", "pending": "Unknown",
    "ไม่ทราบ": "Unknown", "ไม่ระบุ": "Unknown",
}

# ── Lab result mapping ─────────────────────────────────────────────────────────
LAB_RESULT_MAP = {
    "พบเชื้อ": "positive", "ผลบวก": "positive", "พบ": "positive",
    "positive": "positive", "pos": "positive", "detected": "positive",
    "+": "positive", "reactive": "positive",
    "ไม่พบเชื้อ": "negative", "ผลลบ": "negative", "ไม่พบ": "negative",
    "negative": "negative", "neg": "negative", "not detected": "negative",
    "-": "negative", "non-reactive": "negative",
    "รอผล": "pending", "ยังไม่มีผล": "pending",
    "pending": "pending", "awaiting": "pending",
    "ไม่ทราบ": "unknown", "ไม่ระบุ": "unknown", "unknown": "unknown",
}

# ── Binary yes/no mapping ─────────────────────────────────────────────────────
BINARY_MAP: dict[str, int] = {
    "yes": 1, "y": 1, "true": 1, "t": 1, "1": 1,
    "ใช่": 1, "มี": 1, "พบ": 1, "exposed": 1, "confirmed": 1,
    "positive": 1, "oui": 1, "si": 1,
    "no": 0, "n": 0, "false": 0, "f": 0, "0": 0,
    "ไม่ใช่": 0, "ไม่มี": 0, "ไม่พบ": 0, "not exposed": 0,
    "negative": 0, "non": 0,
}

# ── Age unit patterns ─────────────────────────────────────────────────────────
_AGE_UNIT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(year|yr|y|ปี|month|mo|m|เดือน|week|wk|w|สัปดาห์|day|d|วัน)",
    re.IGNORECASE,
)

AGE_BINS   = [0, 5, 15, 25, 35, 45, 55, 65, 200]
AGE_LABELS = ["0-4", "5-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"]

DATE_KNOWN_COLS = [
    "date_onset", "date_report", "date_admitted", "date_discharge",
    "date_outcome", "date_exposure", "date_collected", "date_tested",
    "date_notified", "onset_date", "report_date",
]

_THAI_MONTHS = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5,
    "มิ.ย.": 6, "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10,
    "พ.ย.": 11, "ธ.ค.": 12,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_missing(val: object) -> object:
    try:
        if pd.isna(val):
            return np.nan
    except (ValueError, TypeError):
        pass
    s = str(val).strip()
    if s.lower() in MISSING_STRS:
        return np.nan
    return val


def _parse_date_value(val: object) -> "pd.Timestamp | float":
    """Parse a single date value; handles Buddhist Era (year > 2400 → -543)."""
    if pd.isna(val):
        return np.nan

    s = str(val).strip()
    if not s or s.lower() in MISSING_STRS:
        return np.nan

    # Excel numeric serial
    try:
        n = float(s)
        if 1000 < n < 100000:
            return pd.Timestamp("1899-12-30") + pd.Timedelta(days=int(n))
    except (ValueError, TypeError):
        pass

    # Replace Thai month names with numbers
    for th, num in _THAI_MONTHS.items():
        s = s.replace(th, str(num))

    # Pre-correct Buddhist Era year in the string before pandas sees it.
    # pandas Timestamp max is year 2262, so years like 2569 cause OutOfBoundsDatetime.
    # Pattern: leading 4-digit year >= 2432 (earliest BE year we'd encounter: 1889 CE + 543)
    _BE_LEADING = re.compile(r'^(2[4-9]\d{2}|[3-9]\d{3})([-/\s])(.+)$')
    _BE_TRAILING = re.compile(r'^(.+)([-/\s])(2[4-9]\d{2}|[3-9]\d{3})$')
    m = _BE_LEADING.match(s)
    if m:
        s = str(int(m.group(1)) - 543) + m.group(2) + m.group(3)
    else:
        m = _BE_TRAILING.match(s)
        if m:
            s = m.group(1) + m.group(2) + str(int(m.group(3)) - 543)

    # Try pandas (handles ISO and many formats)
    for fmt in (None, "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
                "%Y/%m/%d", "%Y-%m-%d", "%d %m %Y", "%d %m %y"):
        try:
            ts = pd.to_datetime(s, format=fmt, dayfirst=True) if fmt else pd.to_datetime(s, dayfirst=True)
            if 1900 <= ts.year <= datetime.now().year + 1:
                return ts
        except Exception:
            continue

    return pd.NaT


def _parse_date_column(series: pd.Series) -> pd.Series:
    return series.apply(_parse_date_value)


def _looks_like_date(series: pd.Series, sample_n: int = 30) -> bool:
    """Heuristic: >60% of non-null sample parses as date."""
    s = series.dropna().astype(str).head(sample_n)
    if len(s) < 3:
        return False
    parsed = s.apply(lambda v: _parse_date_value(v))
    ok = parsed.apply(lambda v: isinstance(v, pd.Timestamp) and not pd.isna(v)).sum()
    return ok / len(s) >= 0.6


def _parse_age_with_unit(val: object) -> "float | float":
    """Return (age_years, original_numeric_or_nan)."""
    if pd.isna(val):
        return np.nan
    s = str(val).strip()
    m = _AGE_UNIT_RE.search(s)
    if m:
        num = float(m.group(1))
        unit = m.group(2).lower()
        if unit in ("year", "yr", "y", "ปี"):
            return num
        elif unit in ("month", "mo", "m", "เดือน"):
            return round(num / 12, 3)
        elif unit in ("week", "wk", "w", "สัปดาห์"):
            return round(num / 52.18, 3)
        elif unit in ("day", "d", "วัน"):
            return round(num / 365.25, 3)
    try:
        v = float(s)
        return v
    except (ValueError, TypeError):
        return np.nan


def _row_quality_score(row: pd.Series, required: list[str], date_cols: list[str]) -> int:
    """Score a row 0-100 based on completeness of key fields."""
    score = 100
    # Required fields missing → -20 each, max deduction 60
    for col in required:
        if col in row.index and (pd.isna(row[col]) or str(row[col]).strip() == ""):
            score -= 20
    # Missing date_onset → -10
    if "date_onset" in row.index and pd.isna(row["date_onset"]):
        score -= 10
    # Missing age → -5
    if "age" in row.index and pd.isna(row["age"]):
        score -= 5
    # Missing sex → -5
    if "sex" in row.index and row["sex"] == "Unknown":
        score -= 5
    return max(0, min(100, score))


# ── Main cleaning pipeline ────────────────────────────────────────────────────

def clean_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = df.copy()
    log: list[str] = []
    stats: dict = {}

    # Step 1 — Normalize missing values across all object columns
    for col in df.select_dtypes(include="object").columns:
        before = df[col].isna().sum()
        df[col] = df[col].apply(_normalize_missing)
        after = df[col].isna().sum()
        gained = after - before
        if gained > 0:
            log.append(f"[{col}] Normalized {gained} missing-sentinel strings to NaN")

    # Step 2 — Sex
    if "sex" in df.columns:
        orig = df["sex"].copy()
        df["sex"] = (
            df["sex"].fillna("").astype(str).str.strip().str.lower()
            .map(lambda x: SEX_MAP.get(x, "Unknown"))
        )
        changed = (orig.astype(str) != df["sex"].astype(str)).sum()
        log.append(f"[sex] Standardized → Male/Female/Unknown ({changed} values changed)")

    # Step 3 — Outcome
    if "outcome" in df.columns:
        orig = df["outcome"].copy()
        df["outcome"] = (
            df["outcome"].fillna("").astype(str).str.strip().str.lower()
            .map(lambda x: OUTCOME_MAP.get(x, "Unknown"))
        )
        changed = (orig.astype(str) != df["outcome"].astype(str)).sum()
        log.append(f"[outcome] Standardized → Alive/Dead/Unknown ({changed} values changed)")

    # Step 4 — Lab result
    if "lab_result" in df.columns:
        df["lab_result"] = (
            df["lab_result"].fillna("").astype(str).str.strip().str.lower()
            .map(lambda x: LAB_RESULT_MAP.get(x, "unknown"))
        )
        log.append("[lab_result] Standardized → positive/negative/pending/unknown")

    # Step 5 — Parse known date columns
    date_cols_parsed: list[str] = []
    for col in DATE_KNOWN_COLS:
        if col in df.columns:
            n_before = df[col].isna().sum()
            df[col] = _parse_date_column(df[col])
            n_after = df[col].isna().sum()
            date_cols_parsed.append(col)
            log.append(f"[{col}] Parsed as date ({n_after - n_before} unparseable → NaT)")

    # Step 5b — Auto-detect unknown date columns
    non_std = [c for c in df.columns if c not in DATE_KNOWN_COLS and df[c].dtype == object]
    for col in non_std:
        if any(kw in col.lower() for kw in ("date", "วัน", "เดือน", "dt", "time")):
            if _looks_like_date(df[col]):
                n_before = df[col].isna().sum()
                df[col] = _parse_date_column(df[col])
                n_after = df[col].isna().sum()
                date_cols_parsed.append(col)
                log.append(f"[{col}] Auto-detected and parsed as date")

    stats["date_columns_parsed"] = date_cols_parsed

    # Step 6 — Date logic checks
    if "date_onset" in df.columns and "date_report" in df.columns:
        bad = (df["date_report"] < df["date_onset"]).sum()
        if bad > 0:
            log.append(f"[date logic] {bad} rows have date_report < date_onset (flagged)")
            df.loc[df["date_report"] < df["date_onset"], "_flag_date_order"] = True

    if "date_onset" in df.columns and "date_outcome" in df.columns:
        bad = (df["date_outcome"] < df["date_onset"]).sum()
        if bad > 0:
            log.append(f"[date logic] {bad} rows have date_outcome < date_onset (flagged)")

    # Future dates
    now = pd.Timestamp.now()
    for col in date_cols_parsed:
        future = (df[col] > now).sum()
        if future > 0:
            log.append(f"[{col}] {future} future dates detected (possible Buddhist Era mismatch?)")

    # Step 7 — Age with unit parsing
    if "age" in df.columns:
        df["age"] = df["age"].apply(_parse_age_with_unit)
        df.loc[df["age"] < 0, "age"] = np.nan
        df.loc[df["age"] > 120, "age"] = np.nan
        n_missing = df["age"].isna().sum()
        log.append(f"[age] Parsed (incl. unit conversion); {n_missing} remain missing")

    # Step 8 — Age group
    if "age" in df.columns and "age_group" not in df.columns:
        df["age_group"] = pd.cut(
            df["age"], bins=AGE_BINS, labels=AGE_LABELS, right=False,
        ).astype(str).replace("nan", np.nan)
        log.append("[age_group] Derived from age")

    # Step 9 — Exposure columns (binarize)
    exposure_cols = [c for c in df.columns if c.startswith("exposure_")]
    for col in exposure_cols:
        df[col] = (
            df[col].fillna("").astype(str).str.strip().str.lower()
            .map(lambda x: BINARY_MAP.get(x, 0))
            .astype(int)
        )
    if exposure_cols:
        log.append(f"[exposure] Binarized {len(exposure_cols)} column(s) to 0/1")
    stats["exposure_columns"] = exposure_cols

    # Step 10 — Symptom columns (binarize)
    symptom_cols = [c for c in df.columns if c.startswith("symptom_")]
    for col in symptom_cols:
        df[col] = (
            df[col].fillna("").astype(str).str.strip().str.lower()
            .map(lambda x: BINARY_MAP.get(x, 0))
            .astype(int)
        )
    if symptom_cols:
        log.append(f"[symptom] Binarized {len(symptom_cols)} column(s) to 0/1")
    stats["symptom_columns"] = symptom_cols

    # Step 11 — Known boolean columns
    bool_cols = ["lab_confirmed", "hospitalized", "vaccinated", "isolated"]
    underlying_bools = [c for c in df.columns if c.startswith("underlying_") and c != "underlying_list"]
    bool_cols.extend(underlying_bools)
    
    for col in bool_cols:
        if col in df.columns:
            df[col] = (
                df[col].fillna("").astype(str).str.strip().str.lower()
                .map(lambda x: BINARY_MAP.get(x, np.nan))
            )
            log.append(f"[{col}] Parsed as binary 0/1")

    # Step 12 — case_status
    if "case_status" in df.columns:
        raw = df["case_status"].fillna("").astype(str).str.strip().str.lower()
        mapped = raw.map(lambda x: BINARY_MAP.get(x, None))
        # If mapping fails, try numeric coercion
        fallback = pd.to_numeric(df["case_status"], errors="coerce")
        df["case_status"] = mapped.combine_first(fallback)
        df["case_status"] = df["case_status"].where(df["case_status"].isin([0, 1, 0.0, 1.0]))
        df["case_status"] = pd.to_numeric(df["case_status"], errors="coerce")
        log.append("[case_status] Validated (must be 0 or 1)")

    # Step 13 — Duplicate detection
    key_cols = [c for c in ["case_id", "date_onset", "age", "sex", "district"] if c in df.columns]
    if key_cols:
        dup_mask = df.duplicated(subset=key_cols, keep="first")
        n_dups = dup_mask.sum()
        df["_duplicate_flag"] = dup_mask.astype(int)
        if n_dups > 0:
            log.append(f"[duplicates] {n_dups} potential duplicate rows flagged (key: {key_cols})")

    # Step 14 — Derived: symptom_count
    if symptom_cols:
        df["symptom_count"] = df[symptom_cols].sum(axis=1).astype(int)
        log.append("[symptom_count] Derived from symptom columns")

    # Step 15 — Derived: exposure_count
    if exposure_cols:
        df["exposure_count"] = df[exposure_cols].sum(axis=1).astype(int)
        log.append("[exposure_count] Derived from exposure columns")

    # Step 16 — Epiweek / epiyear
    if "date_onset" in df.columns:
        iso = df["date_onset"].dt.isocalendar()
        df["epiweek"] = iso.week.where(df["date_onset"].notna()).astype("Int64")
        df["epiyear"] = iso.year.where(df["date_onset"].notna()).astype("Int64")
        log.append("[epiweek/epiyear] Derived from date_onset")

    # Step 17 — Onset datetime (combine date + time if both present)
    if "date_onset" in df.columns and "time_onset" in df.columns:
        try:
            time_parsed = pd.to_datetime(
                df["date_onset"].astype(str) + " " + df["time_onset"].astype(str),
                errors="coerce", dayfirst=True,
            )
            df["onset_datetime"] = time_parsed
            log.append("[onset_datetime] Combined date_onset + time_onset")
        except Exception:
            pass

    # Step 18 — Row quality score + cleaning_status
    required_key_cols = [c for c in ["case_id", "age", "sex", "date_onset"] if c in df.columns]
    df["_quality_score"] = df.apply(
        lambda row: _row_quality_score(row, required_key_cols, date_cols_parsed), axis=1
    )
    df["_cleaning_status"] = df["_quality_score"].apply(
        lambda s: "clean" if s >= 80 else ("needs_review" if s >= 50 else "excluded")
    )

    n_clean   = (df["_cleaning_status"] == "clean").sum()
    n_review  = (df["_cleaning_status"] == "needs_review").sum()
    n_excl    = (df["_cleaning_status"] == "excluded").sum()
    log.append(
        f"[quality] clean={n_clean}, needs_review={n_review}, excluded={n_excl} "
        f"(avg score={df['_quality_score'].mean():.1f})"
    )

    stats.update({
        "actions": log,
        "row_count": len(df),
        "rows_flagged": int(n_review + n_excl),
        "quality_avg": round(float(df["_quality_score"].mean()), 1),
        "n_clean": int(n_clean),
        "n_review": int(n_review),
        "n_excluded": int(n_excl),
    })

    return df, stats
