import pandas as pd

def generate_data_quality(df: pd.DataFrame, output_col: str = "met_case_def") -> dict:
    total_records = len(df)
    
    issues = []
    
    unknown_case_def = df[output_col].isna().sum()
    if unknown_case_def > 0:
        issues.append({
            "issue": "Unknown Case Definition",
            "count": int(unknown_case_def),
            "percentage": round((unknown_case_def / total_records) * 100, 1)
        })
        
    if "date_onset" in df.columns:
        missing_onset = df["date_onset"].isna().sum()
        if missing_onset > 0:
            issues.append({
                "issue": "Missing Onset Date",
                "count": int(missing_onset),
                "percentage": round((missing_onset / total_records) * 100, 1)
            })
            
    if "sex" in df.columns:
        missing_sex = df["sex"].isna().sum()
        if missing_sex > 0:
            issues.append({
                "issue": "Missing Sex",
                "count": int(missing_sex),
                "percentage": round((missing_sex / total_records) * 100, 1)
            })
            
    if "_duplicate_flag" in df.columns:
        duplicates = (df["_duplicate_flag"] == 1).sum()
        if duplicates > 0:
            issues.append({
                "issue": "Duplicate Records",
                "count": int(duplicates),
                "percentage": round((duplicates / total_records) * 100, 1)
            })
            
    # High missingness columns
    exposure_cols = [c for c in df.columns if c.startswith("exposure_") and c != "exposure_count"]
    for col in exposure_cols:
        missing = df[col].isna().sum()
        if missing / total_records > 0.2:
            issues.append({
                "issue": f"High Missingness ({col})",
                "count": int(missing),
                "percentage": round((missing / total_records) * 100, 1)
            })
            
    # Sort by count descending
    issues = sorted(issues, key=lambda x: x["count"], reverse=True)
    
    inclusions = [
        {"analysis": "Epi curve", "included": total_records - int(df.get("date_onset", pd.Series()).isna().sum()), "excluded": int(df.get("date_onset", pd.Series()).isna().sum()), "reason": "Missing onset_date"},
        {"analysis": "Exposure analysis", "included": total_records - int(unknown_case_def), "excluded": int(unknown_case_def), "reason": "Unknown case definition"},
    ]

    return {
        "issues": issues,
        "inclusions": inclusions
    }
