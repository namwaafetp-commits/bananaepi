"""Generate a reproducible Python cleaning script from the mapping + cleaning log."""
from __future__ import annotations
from datetime import datetime, timezone


def generate_cleaning_script(
    project_name: str,
    original_filename: str,
    mapping_applied: dict[str, str],
    cleaning_log: list[str],
) -> str:
    renames = {k: v for k, v in mapping_applied.items() if v not in ("skip", "keep", None)}
    drops   = [k for k, v in mapping_applied.items() if v == "skip"]

    L: list[str] = []

    def line(s: str = "") -> None:
        L.append(s)

    line("# " + "=" * 62)
    line(f"# BananaEpi — Auto-Generated Cleaning Script")
    line(f"# Project  : {project_name or 'Unnamed'}")
    line(f"# Source   : {original_filename}")
    line(f"# Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    line("# " + "=" * 62)
    line()
    line("import pandas as pd")
    line("import numpy as np")
    line()
    line(f"df = pd.read_csv({repr(original_filename)}, dtype=str, encoding='utf-8-sig')")
    line(f"print(f'Loaded {{len(df)}} rows, {{len(df.columns)}} columns')")

    # ── Column renaming ───────────────────────────────────────────
    line()
    line("# " + "-" * 60)
    line("# Step 1: Rename columns")
    line("# " + "-" * 60)
    if renames:
        line("df = df.rename(columns={")
        for raw, clean in renames.items():
            line(f"    {repr(raw)}: {repr(clean)},")
        line("})")
    if drops:
        line(f"df = df.drop(columns={drops!r}, errors='ignore')  # skipped columns")

    # ── Standard rule-based cleaning ──────────────────────────────
    line()
    line("# " + "-" * 60)
    line("# Step 2: Standard rule-based cleaning")
    line("# " + "-" * 60)

    line()
    line("# Missing-value normalization")
    line("MISSING = {'', '-', '--', 'na', 'n/a', 'nan', 'none', 'null',")
    line("           'ไม่ทราบ', 'ไม่ระบุ', 'ไม่มีข้อมูล', 'unknown'}")
    line("for col in df.select_dtypes(include='object').columns:")
    line("    df[col] = df[col].apply(lambda v: np.nan if str(v).strip().lower() in MISSING else v)")

    line()
    line("# Sex standardization")
    line("SEX_MAP = {'ชาย': 'Male', 'ช': 'Male', 'm': 'Male', 'male': 'Male', '1': 'Male',")
    line("           'หญิง': 'Female', 'ญ': 'Female', 'f': 'Female', 'female': 'Female', '2': 'Female'}")
    line("if 'sex' in df.columns:")
    line("    df['sex'] = df['sex'].fillna('').str.strip().str.lower().map(lambda x: SEX_MAP.get(x, 'Unknown'))")

    line()
    line("# Date parsing (Buddhist Era aware)")
    line("def parse_dates(series):")
    line("    parsed = pd.to_datetime(series, dayfirst=True, errors='coerce')")
    line("    be_mask = parsed.dt.year > 2400")
    line("    parsed.loc[be_mask] = parsed.loc[be_mask].apply(")
    line("        lambda x: x.replace(year=x.year - 543) if pd.notna(x) else x)")
    line("    return parsed")
    line("for col in [c for c in df.columns if 'date' in c.lower() or 'วัน' in c]:")
    line("    df[col] = parse_dates(df[col])")

    line()
    line("# Age standardization")
    line("if 'age' in df.columns:")
    line("    df['age'] = pd.to_numeric(df['age'], errors='coerce')")
    line("    df.loc[df['age'] < 0, 'age'] = np.nan")
    line("    df.loc[df['age'] > 120, 'age'] = np.nan")
    line("    bins   = [0,5,15,25,35,45,55,65,200]")
    line("    labels = ['0-4','5-14','15-24','25-34','35-44','45-54','55-64','65+']")
    line("    df['age_group'] = pd.cut(df['age'], bins=bins, labels=labels, right=False).astype(str)")

    line()
    line("# Binarize symptom and exposure columns")
    line("BIN_MAP = {'yes':1,'y':1,'1':1,'มี':1,'ใช่':1,'พบ':1,'true':1,")
    line("           'no':0,'n':0,'0':0,'ไม่มี':0,'ไม่ใช่':0,'ไม่พบ':0,'false':0}")
    line("for col in df.columns:")
    line("    if col.startswith('symptom_') or col.startswith('exposure_'):")
    line("        df[col] = df[col].fillna('').str.strip().str.lower().map(lambda x: BIN_MAP.get(x, 0))")

    line()
    line("# Derived columns")
    line("if 'age' in df.columns:")
    line("    df['age_years'] = df['age']")
    line("symptom_cols  = [c for c in df.columns if c.startswith('symptom_')]")
    line("exposure_cols = [c for c in df.columns if c.startswith('exposure_')]")
    line("if symptom_cols:  df['symptom_count']  = df[symptom_cols].sum(axis=1)")
    line("if exposure_cols: df['exposure_count'] = df[exposure_cols].sum(axis=1)")
    line("if 'date_onset' in df.columns:")
    line("    iso = df['date_onset'].dt.isocalendar()")
    line("    df['epiweek'] = iso.week.where(df['date_onset'].notna()).astype('Int64')")
    line("    df['epiyear'] = iso.year.where(df['date_onset'].notna()).astype('Int64')")

    # ── Cleaning log as comments ───────────────────────────────────
    if cleaning_log:
        line()
        line("# " + "-" * 60)
        line("# Cleaning log (auto-recorded by BananaEpi)")
        line("# " + "-" * 60)
        for entry in cleaning_log[:30]:
            line(f"# {entry}")

    line()
    line("# Save")
    line("df.to_csv('cleaned_data.csv', index=False, encoding='utf-8-sig')")
    line("print(f'Done — {{len(df)}} rows, {{len(df.columns)}} columns')")

    return "\n".join(L)
