import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Supabase ─────────────────────────────────────────────────
SUPABASE_URL             = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY        = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
# SUPABASE_JWT_SECRET no longer used — auth now verifies via sb.auth.get_user()
# (Supabase switched to ES256/ECDSA; local HS256 decode is no longer valid)

# ── Telegram bot (payment approval) ──────────────────────────
TELEGRAM_BOT_TOKEN     = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
PRO_PRICE_THB          = int(os.getenv("PRO_PRICE_THB", "99"))

# ── Storage bucket names ─────────────────────────────────────
BUCKET_FILES   = "project-files"    # raw uploads
BUCKET_CLEANED = "project-cleaned"  # cleaned CSVs
BUCKET_OUTPUTS = "project-outputs"  # reports + artifacts

# ── Local temp dir (for matplotlib charts only) ──────────────
BASE_DIR    = Path(__file__).parent
TEMP_DIR    = BASE_DIR / "storage" / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# ── Legacy paths kept for backward compatibility ─────────────
# (mapping.py uses SCHEMA_PATH; remove others after full migration)
STORAGE_DIR   = BASE_DIR / "storage"
UPLOAD_DIR    = STORAGE_DIR / "uploads"
CLEANED_DIR   = STORAGE_DIR / "cleaned"
OUTPUTS_DIR   = STORAGE_DIR / "outputs"
ARTIFACTS_DIR = STORAGE_DIR / "artifacts"
SHARES_DIR    = STORAGE_DIR / "shares"
SCHEMA_PATH   = BASE_DIR / "schemas" / "standard_schema.json"

for _d in [UPLOAD_DIR, CLEANED_DIR, OUTPUTS_DIR, ARTIFACTS_DIR, SHARES_DIR, TEMP_DIR]:
    _d.mkdir(parents=True, exist_ok=True)
