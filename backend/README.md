# EpiAssist Backend — Phase 1

FastAPI backend for outbreak investigation line-list analysis.

## Quick Start

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API is then available at http://localhost:8000  
Interactive docs: http://localhost:8000/docs

---

## Folder Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Path constants, auto-creates storage dirs
│   ├── utils.py                 # Shared helpers (load_metadata, load_cleaned_df)
│   ├── routes/
│   │   ├── upload.py            # POST /upload
│   │   ├── projects.py          # GET/DELETE /projects
│   │   ├── analysis.py          # GET /analysis/{id}/descriptive|analytic|epicurve
│   │   └── report.py            # POST /report/{id}/generate, GET /report/{id}/download
│   ├── services/
│   │   ├── validation.py        # Schema checks against standard_schema.json
│   │   ├── cleaning.py          # Date parsing, sex/outcome standardisation, binarisation
│   │   ├── mutation.py          # Derived columns (incubation period, reporting delay)
│   │   ├── descriptive.py       # Time-place-person summary statistics
│   │   ├── analytic.py          # RR, 95% CI, chi-square / Fisher's exact per exposure_*
│   │   ├── visualization.py     # matplotlib charts → base64 PNG
│   │   └── report.py            # python-docx Word report generator
│   ├── schemas/
│   │   └── standard_schema.json # Column schema definition
│   └── storage/
│       ├── uploads/             # Raw uploaded files
│       ├── cleaned/             # Cleaned CSV per project
│       └── outputs/             # metadata JSON + generated .docx reports
├── requirements.txt
├── generate_example_data.py     # Re-run to regenerate CSVs
├── example_line_list.csv        # 100-row school cafeteria outbreak (pasta salad vehicle)
└── standard_line_list_template.csv
```

---

## API Endpoints

### Upload
| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload/` | Upload CSV or Excel. Returns `project_id`. |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/` | List all projects |
| GET | `/projects/{id}` | Project metadata |
| GET | `/projects/{id}/preview` | First N rows of cleaned data |
| DELETE | `/projects/{id}` | Delete project and all files |

### Analysis
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analysis/{id}/descriptive` | Time-place-person stats, epicurve data |
| GET | `/analysis/{id}/analytic` | RR table for all `exposure_*` columns |
| GET | `/analysis/{id}/epicurve` | Epicurve data + chart (PNG base64) |
| GET | `/analysis/{id}/visualizations` | All charts in one call |

### Report
| Method | Path | Description |
|--------|------|-------------|
| POST | `/report/{id}/generate` | Generate Word (.docx) report |
| GET | `/report/{id}/download` | Download the generated report |

---

## Line-List File Format

### Required columns
| Column | Type | Notes |
|--------|------|-------|
| `case_id` | string | Unique identifier per row |
| `age` | number | Age in years |
| `sex` | string | Male / Female / M / F |
| `date_onset` | date (YYYY-MM-DD) | Blank for non-cases |

### Recommended columns
`date_report`, `date_admitted`, `date_outcome`, `outcome`, `district`, `village`,
`lab_confirmed` (True/False), `hospitalized` (True/False),
`case_status` (**required for RR analysis**: 1 = case, 0 = non-case)

### Exposure columns (any number)
Any column whose name starts with `exposure_` is automatically analyzed.  
Values: `1` / `0` · `Yes` / `No` · `True` / `False`

Example: `exposure_pasta_salad`, `exposure_well_water`, `exposure_raw_chicken`

### Symptom columns (optional)
Any column starting with `symptom_` is summarized in descriptive output.

Example: `symptom_fever`, `symptom_vomiting`, `symptom_diarrhea`

---

## Analytic Method

For each `exposure_*` variable vs `case_status`:

```
              | Case (1) | Non-case (0)
Exposed   (1) |    a     |      b      → AR_exp   = a/(a+b)
Unexposed (0) |    c     |      d      → AR_unexp = c/(c+d)

RR = AR_exp / AR_unexp
95% CI: exp(ln(RR) ± 1.96 × SE)  [log method; Haldane correction if a or c = 0]
p-value: Chi-square (or Fisher's exact if any expected cell < 5)
```

---

## Example Dataset

`example_line_list.csv` simulates a school cafeteria gastroenteritis outbreak:
- **100 persons** investigated (students + staff, Riverside School District)
- **~55 cases** meeting the case definition
- Vehicle: `exposure_pasta_salad` (AR ~80% exposed vs ~15% unexposed, RR ≈ 5)
- Four null exposures: chicken, coleslaw, chocolate cake, fruit punch
- Symptoms: nausea, vomiting, diarrhea, fever, cramps (cases only)
- 12 lab-confirmed; 4 hospitalized

Upload it to test the full pipeline end-to-end.
