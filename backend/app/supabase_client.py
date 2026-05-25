from __future__ import annotations

from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUCKET_FILES, BUCKET_CLEANED, BUCKET_OUTPUTS

_client: Client | None = None


def get_supabase() -> Client:
    """Return the singleton Supabase service-role client."""
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client


def ensure_buckets() -> None:
    """Create storage buckets if they don't exist yet."""
    sb = get_supabase()
    existing = {b.name for b in sb.storage.list_buckets()}
    for name in [BUCKET_FILES, BUCKET_CLEANED, BUCKET_OUTPUTS]:
        if name not in existing:
            try:
                sb.storage.create_bucket(name, options={"public": False})
            except Exception:
                pass  # already exists or dashboard-created — ignore
