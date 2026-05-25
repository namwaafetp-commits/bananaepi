"""
Mutation service: applies additional computed columns after cleaning.
Run this after cleaning if you need derived metrics not covered by the
standard cleaning pipeline (e.g. incubation period, custom age bands).
"""

import pandas as pd
import numpy as np


def add_incubation_period(df: pd.DataFrame) -> pd.DataFrame:
    if "date_exposure" in df.columns and "date_onset" in df.columns:
        df["incubation_days"] = (
            df["date_onset"] - df["date_exposure"]
        ).dt.days
        df.loc[df["incubation_days"] < 0, "incubation_days"] = np.nan
    return df


def add_reporting_delay(df: pd.DataFrame) -> pd.DataFrame:
    if "date_onset" in df.columns and "date_report" in df.columns:
        df["reporting_delay_days"] = (
            df["date_report"] - df["date_onset"]
        ).dt.days
        df.loc[df["reporting_delay_days"] < 0, "reporting_delay_days"] = np.nan
    return df


def add_length_of_stay(df: pd.DataFrame) -> pd.DataFrame:
    if "date_admitted" in df.columns and "date_outcome" in df.columns:
        df["length_of_stay_days"] = (
            df["date_outcome"] - df["date_admitted"]
        ).dt.days
        df.loc[df["length_of_stay_days"] < 0, "length_of_stay_days"] = np.nan
    return df


def add_age_group(df: pd.DataFrame) -> pd.DataFrame:
    if "age" not in df.columns:
        return df
    age = pd.to_numeric(df["age"], errors="coerce")
    bins   = [0, 5, 15, 25, 35, 45, 55, 65, float("inf")]
    labels = ["0–4", "5–14", "15–24", "25–34", "35–44", "45–54", "55–64", "65+"]
    df["age_group"] = pd.cut(age, bins=bins, labels=labels, right=False)
    return df


def apply_all_mutations(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    log: list[str] = []
    df = df.copy()

    before_cols = set(df.columns)
    df = add_incubation_period(df)
    df = add_reporting_delay(df)
    df = add_length_of_stay(df)
    df = add_age_group(df)
    added = set(df.columns) - before_cols
    if added:
        log.append(f"Added derived columns: {sorted(added)}")

    return df, log
