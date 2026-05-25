"""
Column mapping service.

suggest_mapping()  — alias-lookup + difflib fuzzy → auto-suggest standard field for each
                     raw user column.
apply_mapping()    — rename / drop user columns according to a mapping dict.
get_schema()       — return the parsed hierarchical schema (for API responses).
"""

from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

import pandas as pd

SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "standard_schema.json"


def get_schema() -> dict:
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


# ── Alias map builder ────────────────────────────────────────────────────────

def _build_alias_map(schema: dict) -> dict[str, str]:
    """Returns {alias_lower → standard_field_id}."""
    alias_map: dict[str, str] = {}
    for cat in schema["categories"].values():
        for field_id, field in cat["fields"].items():
            alias_map[field_id.lower()] = field_id
            # Strip known category prefix so "ht" matches "underlying_ht"
            for prefix in ("underlying_", "symptom_", "exposure_", "treatment_",
                           "date_", "time_", "lab_"):
                if field_id.startswith(prefix):
                    alias_map[field_id[len(prefix):].lower()] = field_id
                    break
            for alias in field.get("aliases", []):
                alias_map[alias.lower()] = field_id
    return alias_map


def _normalize(name: str) -> str:
    """Lowercase + collapse non-word chars (spaces, punctuation) to underscores. Preserves Thai chars."""
    return re.sub(r"[^\w]+", "_", name.lower()).strip("_")


# ── Suggestion engine ────────────────────────────────────────────────────────

def suggest_mapping(columns: list[str]) -> dict[str, dict]:
    """
    Returns {user_col: {"target": std_field | None, "confidence": float, "method": str}}.
    """
    schema = get_schema()
    alias_map = _build_alias_map(schema)
    all_aliases = list(alias_map.keys())

    result: dict[str, dict] = {}

    for col in columns:
        col_norm = _normalize(col)

        # Already valid prefix → keep as-is (cleaning service picks it up)
        if col_norm.startswith("exposure_") or col_norm.startswith("symptom_") or col_norm.startswith("time_"):
            result[col] = {"target": col_norm, "confidence": 1.0, "method": "prefix"}
            continue

        # Exact alias match
        if col_norm in alias_map:
            result[col] = {"target": alias_map[col_norm], "confidence": 1.0, "method": "exact"}
            continue

        # Try swapping word order: "date_of_onset" → "date_onset" style rewrites
        rewritten = re.sub(r"_of_", "_", col_norm)
        if rewritten != col_norm and rewritten in alias_map:
            result[col] = {"target": alias_map[rewritten], "confidence": 0.92, "method": "rewrite"}
            continue

        # Fuzzy match via difflib (stdlib, no extra deps)
        close = difflib.get_close_matches(col_norm, all_aliases, n=1, cutoff=0.72)
        if close:
            result[col] = {
                "target": alias_map[close[0]],
                "confidence": round(
                    difflib.SequenceMatcher(None, col_norm, close[0]).ratio(), 2
                ),
                "method": "fuzzy",
            }
            continue

        result[col] = {"target": None, "confidence": 0.0, "method": "none"}

    return result


# ── Column profile ───────────────────────────────────────────────────────────

def profile_columns(df: pd.DataFrame) -> list[dict]:
    """Return per-column metadata: dtype, non-null %, sample values."""
    rows = []
    for col in df.columns:
        series = df[col].dropna().astype(str).replace("nan", pd.NA).dropna()
        samples = series.head(4).tolist()
        total = len(df)
        non_null = int(df[col].notna().sum())

        # Simple type inference
        col_norm = _normalize(col)
        if any(kw in col_norm for kw in ("date", "dt", "time", "onset", "report")):
            dtype = "date"
        elif df[col].dropna().astype(str).str.lower().isin(
            {"0", "1", "yes", "no", "true", "false", "y", "n"}
        ).all():
            dtype = "boolean"
        else:
            try:
                pd.to_numeric(df[col].dropna().head(20), errors="raise")
                dtype = "numeric"
            except (ValueError, TypeError):
                dtype = "string"

        rows.append({
            "name": col,
            "dtype": dtype,
            "non_null": non_null,
            "non_null_pct": round(non_null / total * 100, 1) if total else 0.0,
            "sample_values": samples,
        })
    return rows


# ── Apply mapping ────────────────────────────────────────────────────────────

def apply_mapping(df: pd.DataFrame, mapping: dict[str, str]) -> tuple[pd.DataFrame, list[str]]:
    """
    Apply user→standard column mapping.

    mapping values:
      - "skip"   → drop the column
      - "keep"   → keep with original name (no rename)
      - anything else → rename to that value

    Returns (mapped_df, log_messages).
    """
    df = df.copy()
    log: list[str] = []
    rename_map: dict[str, str] = {}
    drop_cols: list[str] = []

    for orig, target in mapping.items():
        if orig not in df.columns:
            continue
        if not target or target == "skip":
            drop_cols.append(orig)
        elif target == "keep":
            pass
        else:
            if orig != target:
                rename_map[orig] = target

    # Determine final column names
    final_cols = []
    for col in df.columns:
        if col in drop_cols:
            continue
        final_cols.append(rename_map.get(col, col))
    
    # Resolve duplicate targets: keep first occurrence, drop the rest
    seen_targets: set[str] = set()
    extra_drops: list[str] = []
    for orig, target in list(rename_map.items()):
        if target in seen_targets:
            extra_drops.append(orig)
            del rename_map[orig]
            if orig not in drop_cols:
                drop_cols.append(orig)
            log.append(f"Skipped duplicate target '{target}' from column '{orig}'")
        else:
            seen_targets.add(target)
    # Also check for columns that already have the target name (no rename needed)
    for col in df.columns:
        if col not in rename_map and col not in drop_cols:
            if col in seen_targets:
                drop_cols.append(col)
                log.append(f"Skipped duplicate target '{col}' (original name)")
            else:
                seen_targets.add(col)

    if drop_cols:
        df = df.drop(columns=drop_cols, errors="ignore")
        log.append(f"Dropped {len(drop_cols)} column(s): {drop_cols}")

    if rename_map:
        df = df.rename(columns=rename_map)
        log.append(f"Renamed {len(rename_map)} column(s): {rename_map}")

    return df, log
