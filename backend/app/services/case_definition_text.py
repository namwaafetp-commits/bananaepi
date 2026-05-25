_LABELS = {
    "onset_date": "symptom onset date", "onset_datetime": "symptom onset date and time",
    "date_onset": "symptom onset date", "date_investigation": "investigation date",
    "date_admission": "admission date", "date_discharge": "discharge date",
    "date_notification": "notification date",
    "location_name": "location", "class": "class", "department": "department",
    "symptom_diarrhea": "diarrhea", "symptom_vomiting": "vomiting",
    "symptom_abdominal_pain": "abdominal pain", "symptom_nausea": "nausea",
    "symptom_fever": "fever", "symptom_cough": "cough", "symptom_rash": "rash",
    "symptom_headache": "headache", "symptom_myalgia": "myalgia",
    "symptom_chills": "chills", "symptom_fatigue": "fatigue",
    "symptom_malaise": "malaise", "symptom_jaundice": "jaundice",
    "symptom_bleeding": "bleeding", "symptom_edema": "edema",
    "diarrhea_times_per_day": "diarrhea frequency (times/day)",
    "lab_result": "laboratory result", "pathogen": "pathogen",
    "temperature": "body temperature",
}

_ABBREV = {
    "abd": "abdominal", "abdom": "abdominal",
    "diarr": "diarrhea", "diar": "diarrhea",
    "vomit": "vomiting", "vom": "vomiting",
    "naus": "nausea", "fev": "fever",
    "temp": "temperature", "tmp": "temperature",
    "ha": "headache", "sob": "shortness of breath",
    "myalg": "myalgia", "arthralg": "arthralgia",
    "hemorrh": "hemorrhage", "jaund": "jaundice",
    "dehydr": "dehydration", "convuls": "convulsion",
    "paralys": "paralysis", "conj": "conjunctival",
    "consti": "constipation", "anorex": "anorexia",
    "bleed": "bleeding", "swell": "swelling",
    "freq": "frequency", "count": "count",
    "onset": "onset", "date": "date", "datetime": "date & time",
    "investigation": "investigation", "notification": "notification",
    "admission": "admission", "discharge": "discharge",
    "province": "province", "district": "district",
    "subdistrict": "sub-district", "village": "village",
    "location": "location", "address": "address",
    "result": "result", "lab": "lab", "pathogen": "pathogen",
}


def _label(field: str) -> str:
    if field in _LABELS:
        return _LABELS[field]
    stripped = field.replace("symptom_", "").replace("lab_", "").replace("numeric_", "")
    return " ".join(_ABBREV.get(w.lower(), w) for w in stripped.split("_"))


# ── Formatters ──────────────────────────────────────────────────────────────

def _fmt_time(rule: dict):
    col = _label(rule.get("column", ""))
    op  = rule.get("operator", "")
    if op == "between":
        return f"had {col} from {rule.get('start')} to {rule.get('end')}"
    if op in ("before", "after", "on"):
        return f"had {col} {op} {rule.get('value')}"
    if op == "not_missing":
        return f"had a known {col}"
    return None


def _fmt_place(rule: dict):
    if rule.get("type") == "place_group":
        parts = []
        for ir in rule.get("rules", []):
            if not ir.get("enabled", True):
                continue
            col = _label(ir.get("column", ""))
            op  = ir.get("operator", "")
            val = ir.get("value", "")
            if op == "equals" and val:
                parts.append(f"{col} is {val}")
            elif op == "in" and ir.get("values"):
                parts.append(f"{col} in {' or '.join(ir['values'])}")
            elif op == "contains" and val:
                parts.append(f"{col} contains {val}")
        return ("was in " + " and ".join(parts)) if parts else None
    col = _label(rule.get("column", ""))
    op  = rule.get("operator", "")
    val = rule.get("value", "")
    if op == "equals" and val:
        return f"was in {col} is {val}"
    return None


def _fmt_symp_block(r: dict):
    rt   = r.get("type")
    cols = [_label(c) for c in r.get("columns", []) if c]
    if not cols:
        return None
    if rt == "symptom_any":
        n = r.get("minimum_required", 1)
        if n == 1:
            return f"had {cols[0]}" if len(cols) == 1 else "had at least one of: " + " or ".join(cols)
        return f"had at least {n} of: " + ", ".join(cols)
    if rt == "symptom_all":
        return f"had {cols[0]}" if len(cols) == 1 else "had " + ", ".join(cols[:-1]) + " and " + cols[-1]
    if rt == "symptom_n_of_m":
        n = r.get("minimum_required", 1)
        return f"had at least {n} of: " + ", ".join(cols)
    if rt == "symptom_binary":
        connector = " or " if r.get("logic", "OR") == "OR" else " and "
        return "had " + connector.join(cols)
    return None


def _fmt_numeric(r: dict):
    col = _label(r.get("column", ""))
    op  = r.get("operator", "")
    if not col or not op:
        return None
    if op == "between":
        return f"{col} between {r.get('min_value')} and {r.get('max_value')}"
    val = r.get("value")
    return f"{col} {op} {val}" if val is not None else None


def _fmt_lab(r: dict):
    col = _label(r.get("column", ""))
    op  = r.get("operator", "")
    if not col:
        return None
    if op == "equals" and r.get("value"):
        return f"{col} is {r['value']}"
    if op == "in" and r.get("values"):
        return f"{col} in {' or '.join(map(str, r['values']))}"
    if op == "not_missing":
        return f"confirmed {col}"
    return None


def _fmt_rule(r: dict):
    rt = r.get("type")
    if rt in ("symptom_any", "symptom_all", "symptom_n_of_m", "symptom_binary"):
        return _fmt_symp_block(r)
    if rt == "numeric_symptom":
        return _fmt_numeric(r)
    if rt == "lab":
        return _fmt_lab(r)
    return None


def _fmt_clinical(rule: dict):
    clinical_logic = rule.get("logic", "OR")
    section_texts  = []

    for group in rule.get("rules", []):
        if not group.get("enabled", True):
            continue
        gtype = group.get("type")

        if gtype == "group":
            group_logic = group.get("logic", "OR")
            block_texts = []
            for r in group.get("rules", []):
                if not r.get("enabled", True):
                    continue
                t = _fmt_rule(r)
                if t:
                    block_texts.append(t)
            if not block_texts:
                continue
            if len(block_texts) == 1:
                section_texts.append(block_texts[0])
            else:
                connector = f" {group_logic} "
                section_texts.append(connector.join(f"({t})" for t in block_texts))
        else:
            t = _fmt_rule(group)
            if t:
                section_texts.append(t)

    if not section_texts:
        return None
    connector = f" {clinical_logic} "
    return connector.join(section_texts)


# ── Public entry point ───────────────────────────────────────────────────────

def generate_human_readable_text(rule_json: dict) -> str:
    name  = rule_json.get("case_definition_name", "Case")
    rules = rule_json.get("rules", [])
    parts = []

    for rule in rules:
        if not rule.get("enabled", True):
            continue
        rtype = rule.get("type")
        if rtype == "time":
            t = _fmt_time(rule)
            if t: parts.append(t)
        elif rtype in ("place", "place_group"):
            t = _fmt_place(rule)
            if t: parts.append(t)
        elif rtype == "clinical_or_lab_group":
            t = _fmt_clinical(rule)
            if t: parts.append(t)

    if not parts:
        return f"{name} case definition — no criteria defined yet."

    sentence = ", AND ".join(parts) if len(parts) > 1 else parts[0]
    return f"{name} case defined as a person who {sentence}."
