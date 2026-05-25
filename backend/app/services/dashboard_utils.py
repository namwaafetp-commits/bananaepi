import pandas as pd
import numpy as np
from scipy.stats import fisher_exact, chi2_contingency

def get_analysis_population(df: pd.DataFrame, output_col: str = "met_case_def"):
    """
    Returns cases, non-cases, and unknown cases based on the case definition output.
    1.0 = Case
    0.0 = Non-case
    NaN = Unknown
    """
    if output_col not in df.columns:
        return df.iloc[0:0], df.iloc[0:0], df.iloc[0:0]
        
    cases = df[df[output_col] == 1.0]
    non_cases = df[df[output_col] == 0.0]
    unknown = df[df[output_col].isna()]
    
    return cases, non_cases, unknown

def calculate_attack_rate(cases: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round((cases / total) * 100, 1)

def calculate_2x2_table(df: pd.DataFrame, exposure_col: str, output_col: str = "met_case_def"):
    """
    Returns a dict with 2x2 table counts.
    Assumes exposure_col is 1 (Exposed) or 0 (Unexposed).
    """
    if exposure_col not in df.columns or output_col not in df.columns:
        return None
        
    # Drop rows missing exposure or case def
    valid_df = df.dropna(subset=[exposure_col, output_col])
    
    cases_exposed = len(valid_df[(valid_df[exposure_col] == 1) & (valid_df[output_col] == 1.0)])
    cases_unexposed = len(valid_df[(valid_df[exposure_col] == 0) & (valid_df[output_col] == 1.0)])
    controls_exposed = len(valid_df[(valid_df[exposure_col] == 1) & (valid_df[output_col] == 0.0)])
    controls_unexposed = len(valid_df[(valid_df[exposure_col] == 0) & (valid_df[output_col] == 0.0)])
    
    return {
        "cases_exposed": cases_exposed,
        "cases_unexposed": cases_unexposed,
        "controls_exposed": controls_exposed,
        "controls_unexposed": controls_unexposed,
        "total_exposed": cases_exposed + controls_exposed,
        "total_unexposed": cases_unexposed + controls_unexposed,
        "total_cases": cases_exposed + cases_unexposed,
        "total_controls": controls_exposed + controls_unexposed
    }

def calculate_rr(cases_exp, controls_exp, cases_unexp, controls_unexp):
    total_exp = cases_exp + controls_exp
    total_unexp = cases_unexp + controls_unexp
    
    if total_exp == 0 or total_unexp == 0:
        return None, None, None, None, None

    ar_exp = cases_exp / total_exp
    ar_unexp = cases_unexp / total_unexp

    if ar_unexp == 0:
        return float('inf'), None, None, None, None
        
    rr = ar_exp / ar_unexp
    
    # Calculate 95% CI
    try:
        se = np.sqrt((1/cases_exp if cases_exp > 0 else 0) - (1/total_exp) + 
                     (1/cases_unexp if cases_unexp > 0 else 0) - (1/total_unexp))
        ci_lower = rr * np.exp(-1.96 * se)
        ci_upper = rr * np.exp(1.96 * se)
    except:
        ci_lower = None
        ci_upper = None
        
    # Choose Fisher or Chi-Square based on expected counts
    table = [[cases_exp, controls_exp], [cases_unexp, controls_unexp]]
    try:
        chi2, p_val, dof, expected = chi2_contingency(table)
        if (expected < 5).any():
            _, p_val = fisher_exact(table)
            test_used = "Fisher's Exact Test"
        else:
            test_used = "Chi-Square Test"
    except:
        p_val = None
        test_used = "Unknown"
        
    return round(rr, 2), round(ci_lower, 2) if ci_lower else None, round(ci_upper, 2) if ci_upper else None, p_val, test_used
