import pandas as pd
import numpy as np

def combine_and(series_list):
    """
    If any is false (0) -> 0
    Else if any is unknown (NaN) -> NaN
    Else -> 1
    """
    if not series_list:
        return None
    df = pd.concat(series_list, axis=1)
    
    # Check if any is 0
    has_false = (df == 0).any(axis=1)
    # Check if any is NaN
    has_nan = df.isna().any(axis=1)
    
    result = pd.Series(1.0, index=df.index)
    result[has_nan] = np.nan
    result[has_false] = 0.0
    
    return result

def combine_or(series_list):
    """
    If any is true (1) -> 1
    Else if any is unknown (NaN) -> NaN
    Else -> 0
    """
    if not series_list:
        return None
    df = pd.concat(series_list, axis=1)
    
    # Check if any is 1
    has_true = (df == 1).any(axis=1)
    # Check if any is NaN
    has_nan = df.isna().any(axis=1)
    
    result = pd.Series(0.0, index=df.index)
    result[has_nan] = np.nan
    result[has_true] = 1.0
    
    return result

def evaluate_time_rule(df: pd.DataFrame, rule: dict) -> pd.Series:
    col = rule.get("column")
    if not col or col not in df.columns:
        return pd.Series(np.nan, index=df.index)
    
    series = pd.to_datetime(df[col], errors="coerce")
    op = rule.get("operator")
    
    if op == "between":
        start = pd.to_datetime(rule.get("start"))
        end = pd.to_datetime(rule.get("end"))
        mask = (series >= start) & (series <= end)
    elif op == "before":
        val = pd.to_datetime(rule.get("value"))
        mask = series < val
    elif op == "after":
        val = pd.to_datetime(rule.get("value"))
        mask = series > val
    elif op == "on":
        val = pd.to_datetime(rule.get("value"))
        mask = series == val
    elif op == "not_missing":
        mask = ~series.isna()
    else:
        return pd.Series(np.nan, index=df.index)
        
    result = mask.astype(float)
    result[series.isna() & (op != "not_missing")] = np.nan
    return result

def evaluate_place_rule(df: pd.DataFrame, rule: dict) -> pd.Series:
    col = rule.get("column")
    if not col or col not in df.columns:
        return pd.Series(np.nan, index=df.index)
    
    series = df[col]
    op = rule.get("operator")
    
    if op == "equals":
        mask = series == rule.get("value")
    elif op == "not_equals":
        mask = series != rule.get("value")
    elif op == "in":
        mask = series.isin(rule.get("values", []))
    elif op == "not_in":
        mask = ~series.isin(rule.get("values", []))
    elif op == "contains":
        mask = series.astype(str).str.contains(str(rule.get("value")), na=False, case=False)
    elif op == "not_missing":
        mask = ~series.isna() & (series != "")
    else:
        return pd.Series(np.nan, index=df.index)
        
    result = mask.astype(float)
    result[series.isna() & (op != "not_missing")] = np.nan
    return result

def evaluate_symptom_rule(df: pd.DataFrame, rule: dict) -> pd.Series:
    cols = [c for c in rule.get("columns", []) if c in df.columns]
    if not cols:
        return pd.Series(np.nan, index=df.index)
    
    # Convert symptoms to numeric (1/0), keep NaNs
    sym_df = df[cols].apply(pd.to_numeric, errors="coerce")
    
    rt = rule.get("type")
    if rt == "symptom_any":
        min_req = rule.get("minimum_required", 1)
        count_true = (sym_df == 1).sum(axis=1)
        count_nan = sym_df.isna().sum(axis=1)
        
        result = pd.Series(0.0, index=df.index)
        result[count_true >= min_req] = 1.0
        
        # If not true, but (count_true + count_nan) >= min_req, it's unknown
        unknown_mask = (result == 0.0) & ((count_true + count_nan) >= min_req)
        result[unknown_mask] = np.nan
        return result
        
    elif rt == "symptom_all":
        count_true = (sym_df == 1).sum(axis=1)
        count_nan = sym_df.isna().sum(axis=1)
        req = len(cols)
        
        result = pd.Series(0.0, index=df.index)
        result[count_true == req] = 1.0
        
        unknown_mask = (result == 0.0) & ((count_true + count_nan) == req)
        result[unknown_mask] = np.nan
        return result
        
    elif rt == "symptom_n_of_m":
        min_req = rule.get("minimum_required", 1)
        count_true = (sym_df == 1).sum(axis=1)
        count_nan = sym_df.isna().sum(axis=1)

        result = pd.Series(0.0, index=df.index)
        result[count_true >= min_req] = 1.0

        unknown_mask = (result == 0.0) & ((count_true + count_nan) >= min_req)
        result[unknown_mask] = np.nan
        return result

    elif rt == "symptom_binary":
        logic = rule.get("logic", "OR")
        count_true = (sym_df == 1).sum(axis=1)
        count_nan = sym_df.isna().sum(axis=1)
        req = len(cols)

        if logic == "AND":
            result = pd.Series(0.0, index=df.index)
            result[count_true == req] = 1.0
            unknown_mask = (result == 0.0) & ((count_true + count_nan) == req)
            result[unknown_mask] = np.nan
        else:  # OR
            result = pd.Series(0.0, index=df.index)
            result[count_true >= 1] = 1.0
            unknown_mask = (result == 0.0) & ((count_true + count_nan) >= 1)
            result[unknown_mask] = np.nan
        return result

    return pd.Series(np.nan, index=df.index)

def evaluate_numeric_rule(df: pd.DataFrame, rule: dict) -> pd.Series:
    col = rule.get("column")
    if not col or col not in df.columns:
        return pd.Series(np.nan, index=df.index)
    
    series = pd.to_numeric(df[col], errors="coerce")
    op = rule.get("operator")
    
    if op == "between":
        mask = (series >= rule.get("min_value")) & (series <= rule.get("max_value"))
    elif op == ">=":
        mask = series >= rule.get("value")
    elif op == ">":
        mask = series > rule.get("value")
    elif op == "=":
        mask = series == rule.get("value")
    elif op == "<=":
        mask = series <= rule.get("value")
    elif op == "<":
        mask = series < rule.get("value")
    else:
        return pd.Series(np.nan, index=df.index)
        
    result = mask.astype(float)
    result[series.isna()] = np.nan
    return result

def evaluate_lab_rule(df: pd.DataFrame, rule: dict) -> pd.Series:
    # MVP lab rule is similar to place rule
    return evaluate_place_rule(df, dict(rule, type="place"))

def evaluate_single_rule(df: pd.DataFrame, rule: dict) -> pd.Series:
    rule_type = rule.get("type")
    if rule_type == "time":
        return evaluate_time_rule(df, rule)
    if rule_type == "place":
        return evaluate_place_rule(df, rule)
    if rule_type in ["symptom_any", "symptom_all", "symptom_n_of_m", "symptom_binary"]:
        return evaluate_symptom_rule(df, rule)
    if rule_type == "numeric_symptom":
        return evaluate_numeric_rule(df, rule)
    if rule_type == "lab":
        return evaluate_lab_rule(df, rule)
    return pd.Series(np.nan, index=df.index)

def evaluate_rule_group(df: pd.DataFrame, group: dict) -> tuple:
    logic = group.get("logic", "AND")
    results = []
    
    # We also want to track missing fields and reasons but for MVP we will aggregate simply
    
    for rule in group.get("rules", []):
        if not rule.get("enabled", True):
            continue

        # Safely determine if it's a nested group
        is_group = rule.get("type") in ("group", "clinical_or_lab_group", "place_group") or (
            "rules" in rule and isinstance(rule.get("rules"), list)
        )

        if is_group:
            active_children = [r for r in rule.get("rules", []) if isinstance(r, dict) and r.get("enabled", True)]
            if not active_children:
                continue
            rule_res, _, _ = evaluate_rule_group(df, rule)
            if rule_res is not None:
                results.append(rule_res)
        else:
            rule_res = evaluate_single_rule(df, rule)
            if rule_res is not None:
                results.append(rule_res)
            
    if not results:
        # If an AND group is completely empty, default to 1.0 (True) so it doesn't fail outer logic.
        # If an OR group is completely empty, it shouldn't match anything.
        if logic == "OR":
            return pd.Series(0.0, index=df.index), "Evaluated", []
        res = pd.Series(1.0, index=df.index)
        return res, "Evaluated", []
    elif logic == "AND":
        res = combine_and(results)
    elif logic == "OR":
        res = combine_or(results)
    else:
        res = pd.Series(1.0, index=df.index)
        
    return res, "Evaluated", []

def apply_case_definition(df: pd.DataFrame, rule_json: dict, output_col: str = "met_case_def") -> pd.DataFrame:
    enabled_rules = [r for r in rule_json.get("rules", []) if r.get("enabled", True)]

    if not enabled_rules:
        # No rules at all — nobody is a case
        result_series = pd.Series(0.0, index=df.index)
    else:
        root_group = {
            "logic": rule_json.get("logic", "AND"),
            "rules": enabled_rules,
        }
        result_series, _, _ = evaluate_rule_group(df, root_group)

    if result_series is None:
        result_series = pd.Series(0.0, index=df.index)
        
    df[output_col] = result_series.fillna(0)
    
    def map_status(val):
        if pd.isna(val): return "non_case"
        if val == 1.0: return "case"
        return "non_case"

    df["case_def_status"] = result_series.apply(map_status)

    df["case_def_reason"] = df["case_def_status"].map({
        "case": "Met criteria",
        "non_case": "Did not meet criteria",
    })

    df["case_def_missing_fields"] = ""
    
    df["case_def_version"] = rule_json.get("version", "v1")
    
    return df
