"""
Visualization service: generates matplotlib charts as base64-encoded PNGs.
All functions return {"image_base64": str, "format": "png"} or {"error": str}.
"""

from __future__ import annotations

import io
import base64
from typing import Any

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # non-interactive backend — must be set before pyplot import
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


BLUE = "#2563EB"
RED = "#EF4444"
GREEN = "#22C55E"
GRAY = "#6B7280"
PINK = "#EC4899"

# Use Tahoma — a Windows system font with full Thai Unicode support
import matplotlib.font_manager as _fm
_THAI_CANDIDATES = ["Tahoma", "TH SarabunPSK", "Leelawadee UI", "Leelawadee",
                    "Cordia New", "Microsoft Sans Serif", "Arial Unicode MS"]
_available = {f.name for f in _fm.fontManager.ttflist}
_FONT = next((f for f in _THAI_CANDIDATES if f in _available), "DejaVu Sans")

STYLE = {
    "font.family": _FONT,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "axes.grid.axis": "y",
    "grid.alpha": 0.3,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
}


def _encode(fig: plt.Figure) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return encoded


def _build_onset_dt(df: pd.DataFrame) -> pd.Series:
    """Return date_onset as datetime, combining with time_onset if present."""
    dt = df["date_onset"].copy()
    if "time_onset" in df.columns:
        try:
            combined = pd.to_datetime(
                df["date_onset"].dt.strftime("%Y-%m-%d") + " " + df["time_onset"].astype(str),
                errors="coerce",
            )
            dt = combined.where(combined.notna(), dt)
        except Exception:
            pass
    return dt


def epicurve_rows(df: pd.DataFrame, by: str = "day", interval: int = 1) -> list[dict]:
    """Return aggregated [{label, count}] rows for any epicurve mode."""
    if "date_onset" not in df.columns:
        return []

    if by == "hour":
        dt = _build_onset_dt(df).dropna()
        if dt.empty:
            return []
        bucketed = dt.dt.floor(f"{max(1, interval)}h")
        counts = bucketed.value_counts().sort_index()
        return [{"label": t.strftime("%Y-%m-%d %H:%M"), "count": int(c)}
                for t, c in counts.items()]

    if by == "week":
        if "epiweek" in df.columns and "epiyear" in df.columns:
            valid = df.dropna(subset=["epiweek", "epiyear"])
            labels = (valid["epiyear"].astype(int).astype(str) + "-W" +
                      valid["epiweek"].astype(int).astype(str).str.zfill(2))
        else:
            valid = df.dropna(subset=["date_onset"])
            labels = valid["date_onset"].dt.strftime("%G-W%V")
        counts = labels.value_counts().sort_index()
        return [{"label": k, "count": int(v)} for k, v in counts.items()]

    if by == "month":
        valid = df.dropna(subset=["date_onset"])
        if valid.empty:
            return []
        monthly = valid.groupby(valid["date_onset"].dt.to_period("M")).size()
        return [{"label": str(k), "count": int(v)} for k, v in monthly.items()]

    # day (default)
    valid = df.dropna(subset=["date_onset"])
    if valid.empty:
        return []
    daily = valid.groupby(valid["date_onset"].dt.date).size()
    return [{"label": str(k), "count": int(v)} for k, v in daily.items()]


def epicurve_stacked(
    df: pd.DataFrame, by: str = "day", interval: int = 1, stack_by: str = "sex"
) -> tuple[list[dict], list[str]]:
    """Cross-tabulate epicurve by a grouping column. Returns (rows, keys).
    rows format: [{label, key1: count, key2: count, ...}]
    """
    if "date_onset" not in df.columns or stack_by not in df.columns:
        return [], []

    work = df.copy()

    if by == "hour":
        dt = _build_onset_dt(work)
        work["_label"] = dt.dt.floor(f"{max(1, interval)}h").dt.strftime("%Y-%m-%d %H:%M")
    elif by == "week":
        if "epiweek" in work.columns and "epiyear" in work.columns:
            work["_label"] = (
                work["epiyear"].astype(float).fillna(-1).astype(int).astype(str)
                + "-W"
                + work["epiweek"].astype(float).fillna(-1).astype(int).astype(str).str.zfill(2)
            )
        else:
            work["_label"] = work["date_onset"].dt.strftime("%G-W%V")
    elif by == "month":
        work["_label"] = work["date_onset"].dt.to_period("M").astype(str)
    else:
        work["_label"] = work["date_onset"].dt.date.astype(str)

    work["_stack"] = work[stack_by].astype(str)
    work = work.dropna(subset=["_label", "_stack"])
    work = work[work["_stack"] != "nan"]

    if work.empty:
        return [], []

    pivot = work.groupby(["_label", "_stack"]).size().unstack(fill_value=0).sort_index()
    keys = list(pivot.columns)
    rows = [
        {"label": str(lbl), **{k: int(pivot.loc[lbl, k]) for k in keys}}
        for lbl in pivot.index
    ]
    return rows, keys


def generate_epicurve(df: pd.DataFrame, by: str = "day", interval: int = 1) -> dict[str, Any]:
    if "date_onset" not in df.columns:
        return {"error": "Column 'date_onset' not found"}

    _XLABEL = {
        "hour":  f"วันที่-เวลา (ทุก {interval} ชั่วโมง)",
        "day":   "วันที่เริ่มมีอาการ",
        "week":  "สัปดาห์ระบาดวิทยา",
        "month": "เดือน",
    }
    _TITLE = {
        "hour":  f"รายชั่วโมง (interval {interval} ชม.)",
        "day":   "รายวัน",
        "week":  "รายสัปดาห์",
        "month": "รายเดือน",
    }

    with plt.rc_context(STYLE):
        fig, ax = plt.subplots(figsize=(13, 5))

        if by == "hour":
            dt = _build_onset_dt(df).dropna()
            if dt.empty:
                return {"error": "No valid datetime data for hour view. Map date_onset (and time_onset if available)."}
            bucketed = dt.dt.floor(f"{max(1, interval)}h")
            counts   = bucketed.value_counts().sort_index()
            x = range(len(counts))
            ax.bar(x, counts.values, color=BLUE, edgecolor="white", linewidth=0.5, width=0.8)
            ax.set_xticks(list(x))
            ax.set_xticklabels(
                [t.strftime("%d/%m\n%H:%M") for t in counts.index],
                fontsize=8, ha="center",
            )

        elif by == "week":
            if "epiweek" in df.columns and "epiyear" in df.columns:
                valid = df.dropna(subset=["epiweek", "epiyear"])
                if valid.empty:
                    return {"error": "No valid epiweek data"}
                labels = (valid["epiyear"].astype(int).astype(str) + "-W" +
                          valid["epiweek"].astype(int).astype(str).str.zfill(2))
                counts = labels.value_counts().sort_index()
            else:
                valid = df.dropna(subset=["date_onset"])
                if valid.empty:
                    return {"error": "No valid onset dates"}
                counts = valid["date_onset"].dt.strftime("%G-W%V").value_counts().sort_index()
            x = range(len(counts))
            ax.bar(x, counts.values, color=BLUE, edgecolor="white", linewidth=0.5, width=0.8)
            ax.set_xticks(list(x))
            ax.set_xticklabels(counts.index, rotation=45, ha="right", fontsize=9)

        elif by == "month":
            valid = df.dropna(subset=["date_onset"])
            if valid.empty:
                return {"error": "No valid onset dates"}
            monthly = valid.groupby(valid["date_onset"].dt.to_period("M")).size()
            x = range(len(monthly))
            ax.bar(x, monthly.values, color=BLUE, edgecolor="white", linewidth=0.5, width=0.8)
            ax.set_xticks(list(x))
            ax.set_xticklabels([str(p) for p in monthly.index], rotation=45, ha="right", fontsize=9)

        else:  # day
            valid = df.dropna(subset=["date_onset"])
            if valid.empty:
                return {"error": "No valid onset dates"}
            daily = valid.groupby(valid["date_onset"].dt.date).size()
            x = range(len(daily))
            ax.bar(x, daily.values, color=BLUE, edgecolor="white", linewidth=0.5, width=0.8)
            ax.set_xticks(list(x))
            ax.set_xticklabels([str(d) for d in daily.index], rotation=45, ha="right", fontsize=9)

        ax.set_xlabel(_XLABEL.get(by, by), fontsize=11)
        ax.set_ylabel("จำนวนผู้ป่วย", fontsize=11)
        ax.set_title(f"เส้นโค้งระบาด — {_TITLE.get(by, by)}", fontweight="bold", fontsize=14, pad=12)
        plt.tight_layout()

    return {"image_base64": _encode(fig), "format": "png"}


def generate_age_sex_pyramid(df: pd.DataFrame) -> dict[str, Any]:
    if "age_group" not in df.columns or "sex" not in df.columns:
        return {"error": "Columns 'age_group' and 'sex' are required"}

    age_order = ["0-4", "5-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    age_order = [g for g in age_order if g in df["age_group"].values]
    if not age_order:
        return {"error": "No valid age_group values found"}

    males = df[df["sex"] == "Male"]["age_group"].value_counts()
    females = df[df["sex"] == "Female"]["age_group"].value_counts()

    male_vals = [-males.get(g, 0) for g in age_order]
    female_vals = [females.get(g, 0) for g in age_order]
    y = list(range(len(age_order)))

    with plt.rc_context(STYLE):
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.barh(y, male_vals, color=BLUE, alpha=0.85, label="Male")
        ax.barh(y, female_vals, color=PINK, alpha=0.85, label="Female")
        ax.set_yticks(y)
        ax.set_yticklabels(age_order, fontsize=10)
        ax.axvline(0, color="black", linewidth=0.8)

        max_val = max(abs(min(male_vals)), max(female_vals), 1) + 2
        ax.set_xlim(-max_val, max_val)
        step = max(1, max_val // 5)
        ticks = list(range(-max_val, max_val + 1, step))
        ax.set_xticks(ticks)
        ax.set_xticklabels([str(abs(t)) for t in ticks])

        ax.set_xlabel("Number of Cases", fontsize=11)
        ax.set_title("Age–Sex Pyramid", fontweight="bold", fontsize=14, pad=12)
        ax.legend(loc="lower right")
        ax.grid(axis="x", alpha=0.3)
        ax.set_axisbelow(True)
        plt.tight_layout()

    return {"image_base64": _encode(fig), "format": "png"}


def generate_attack_rate_chart(analytic_results: list[dict]) -> dict[str, Any]:
    valid = [r for r in analytic_results if r.get("rr") is not None and "error" not in r]
    if not valid:
        return {"error": "No valid RR results to plot"}

    valid = sorted(valid, key=lambda x: x.get("rr", 0), reverse=True)[:15]
    labels = [r["exposure"] for r in valid]
    ar_exp = [r["ar_exposed_pct"] for r in valid]
    ar_unexp = [r["ar_unexposed_pct"] for r in valid]

    x = np.arange(len(labels))
    w = 0.35

    with plt.rc_context(STYLE):
        fig, ax = plt.subplots(figsize=(max(10, len(labels) * 1.1), 6))
        b1 = ax.bar(x - w / 2, ar_exp, w, label="Exposed", color=RED, alpha=0.85)
        b2 = ax.bar(x + w / 2, ar_unexp, w, label="Unexposed", color=GREEN, alpha=0.85)

        for bar in list(b1) + list(b2):
            h = bar.get_height()
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                h + 1,
                f"{h:.0f}%",
                ha="center",
                va="bottom",
                fontsize=8,
            )

        ax.set_xticks(list(x))
        ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=9)
        ax.set_ylabel("Attack Rate (%)", fontsize=11)
        ax.set_ylim(0, 115)
        ax.set_title("Attack Rates by Exposure Factor", fontweight="bold", fontsize=14, pad=12)
        ax.legend()
        plt.tight_layout()

    return {"image_base64": _encode(fig), "format": "png"}


def generate_forest_plot(analytic_results: list[dict], measure: str = "rr") -> dict[str, Any]:
    valid = [
        r for r in analytic_results
        if r.get("rr") is not None
        and r.get("ci_lower") is not None
        and r.get("ci_upper") is not None
        and "error" not in r
    ]
    if not valid:
        return {"error": "No valid RR/CI values for forest plot"}

    valid = sorted(valid, key=lambda x: x.get("rr", 0))
    n = len(valid)
    height = max(4, n * 0.7 + 2)

    with plt.rc_context(STYLE):
        fig, ax = plt.subplots(figsize=(11, height))
        ax.grid(False)

        all_lowers = [r["ci_lower"] for r in valid]
        all_uppers = [r["ci_upper"] for r in valid]
        x_max = max(all_uppers) if all_uppers else 10
        text_x = x_max * 1.08

        for i, r in enumerate(valid):
            color = RED if r.get("significant") else GRAY
            ax.plot([r["ci_lower"], r["ci_upper"]], [i, i], color=color, linewidth=2.2)
            ax.plot(r["rr"], i, "D", color=color, markersize=7, zorder=3)

            p_str = f"p={r['p_value']:.3f}" if r.get("p_value") is not None else ""
            label = f"RR {r['rr']:.2f} ({r['ci_lower']:.2f}–{r['ci_upper']:.2f})  {p_str}"
            ax.text(text_x, i, label, va="center", fontsize=8.5, color="#111827")

        ax.axvline(1.0, color="#374151", linestyle="--", linewidth=1.2, alpha=0.7)
        ax.set_yticks(list(range(n)))
        ax.set_yticklabels([r["exposure"] for r in valid], fontsize=10)
        _label = "Odds Ratio (OR)" if measure == "or" else "Risk Ratio (RR)"
        _title = "Forest Plot — Odds Ratios with 95% CI" if measure == "or" else "Forest Plot — Risk Ratios with 95% CI"
        ax.set_xlabel(_label, fontsize=11)
        ax.set_title(_title, fontweight="bold", fontsize=14, pad=12)

        ax.set_xlim(min(all_lowers) * 0.8, text_x + 4)
        ax.spines["left"].set_visible(False)
        ax.tick_params(axis="y", length=0)

        sig_patch = mpatches.Patch(color=RED, label="p < 0.05 (significant)")
        ns_patch = mpatches.Patch(color=GRAY, label="p ≥ 0.05 (not significant)")
        ax.legend(handles=[sig_patch, ns_patch], loc="lower right", fontsize=9)

        plt.tight_layout()

    return {"image_base64": _encode(fig), "format": "png"}


def generate_symptom_bar(descriptive: dict) -> dict[str, Any]:
    symptoms = descriptive.get("symptoms", {})
    if not symptoms:
        return {"error": "No symptom data in descriptive results"}

    items = sorted(symptoms.items(), key=lambda x: x[1].get("percent", 0) or 0, reverse=True)
    labels = [k for k, _ in items]
    pcts = [v.get("percent", 0) or 0 for _, v in items]

    with plt.rc_context(STYLE):
        fig, ax = plt.subplots(figsize=(max(7, len(labels) * 1.0), 5))
        bars = ax.bar(labels, pcts, color=BLUE, alpha=0.85, edgecolor="white")
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + 0.5, f"{h:.0f}%",
                    ha="center", va="bottom", fontsize=9)
        ax.set_ylabel("% of Cases", fontsize=11)
        ax.set_ylim(0, 115)
        ax.set_title("Symptom Frequency Among Cases", fontweight="bold", fontsize=14, pad=12)
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, rotation=25, ha="right")
        plt.tight_layout()

    return {"image_base64": _encode(fig), "format": "png"}


def generate_symptom_bar_from_person(symptoms: list[dict]) -> dict[str, Any]:
    """Dashboard person format: [{symptom, cases_with_symptom, percentage}]."""
    if not symptoms:
        return {"error": "No symptom data"}

    items = sorted(symptoms, key=lambda x: x.get("percentage", 0), reverse=True)
    labels = [s["symptom"] for s in items]
    pcts   = [s.get("percentage", 0) for s in items]

    with plt.rc_context(STYLE):
        fig, ax = plt.subplots(figsize=(max(7, len(labels) * 1.0), 5))
        bars = ax.bar(labels, pcts, color=BLUE, alpha=0.85, edgecolor="white")
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + 0.5, f"{h:.0f}%",
                    ha="center", va="bottom", fontsize=9)
        ax.set_ylabel("% of Cases", fontsize=11)
        ax.set_ylim(0, 115)
        ax.set_title("Symptom Frequency Among Cases", fontweight="bold", fontsize=14, pad=12)
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, rotation=25, ha="right")
        plt.tight_layout()

    return {"image_base64": _encode(fig), "format": "png"}
