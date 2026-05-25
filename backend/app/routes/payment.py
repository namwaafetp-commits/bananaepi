from __future__ import annotations

from datetime import datetime, date, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import get_current_user
from app.config import TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, PRO_PRICE_THB
from app.supabase_client import get_supabase

router = APIRouter(tags=["Payment"])


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_plan(user_id: str) -> str:
    """Return user's current plan ('free' or 'pro')."""
    sb = get_supabase()
    r = sb.table("profiles").select("plan").eq("id", user_id).single().execute()
    return (r.data or {}).get("plan", "free")


def check_upload_rate_limit(user_id: str) -> None:
    """
    Called before every upload.
    - Free  : max 1 new project per calendar day (UTC).
    - Pro   : max 1 new project per 5 minutes.
    Raises HTTP 429 with a structured detail dict on violation.
    """
    sb   = get_supabase()
    plan = _get_plan(user_id)

    if plan == "free":
        today_start = date.today().isoformat() + "T00:00:00+00:00"
        r = (
            sb.table("projects")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", today_start)
            .execute()
        )
        if (r.count or 0) >= 1:
            raise HTTPException(
                status_code=429,
                detail={
                    "error":   "rate_limit",
                    "plan":    "free",
                    "message": "แผน Free จำกัด 1 การสอบสวนต่อวัน — อัปเกรดเป็น Pro เพื่อใช้งานไม่จำกัด",
                },
            )

    else:  # pro
        r = (
            sb.table("projects")
            .select("created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if r.data:
            last = datetime.fromisoformat(r.data[0]["created_at"].replace("Z", "+00:00"))
            diff = datetime.now(timezone.utc) - last
            if diff < timedelta(minutes=5):
                wait = int((timedelta(minutes=5) - diff).total_seconds())
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error":       "rate_limit",
                        "plan":        "pro",
                        "message":     f"Rate limit: รอ {wait} วินาที แล้วลองใหม่อีกครั้ง",
                        "retry_after": wait,
                    },
                )


def _tg_send(text: str) -> int | None:
    """Send a message to admin via Telegram bot. Returns message_id or None."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_ADMIN_CHAT_ID:
        return None
    try:
        r = httpx.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={
                "chat_id":    TELEGRAM_ADMIN_CHAT_ID,
                "text":       text,
                "parse_mode": "Markdown",
            },
            timeout=10,
        )
        if r.status_code == 200:
            return r.json()["result"]["message_id"]
    except Exception as exc:
        print(f"[Telegram] send failed: {exc}", flush=True)
    return None


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/payment/status")
def get_payment_status(user: dict = Depends(get_current_user)):
    """Return current plan and most-recent payment request status."""
    sb   = get_supabase()
    plan = _get_plan(user["user_id"])

    last = (
        sb.table("payment_requests")
        .select("status, created_at")
        .eq("user_id", user["user_id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    last_req = last.data[0] if last.data else None

    return {
        "plan":           plan,
        "price_thb":      PRO_PRICE_THB,
        "payment_status": last_req["status"] if last_req else None,
        "pending_since":  (
            last_req["created_at"]
            if last_req and last_req["status"] == "pending"
            else None
        ),
    }


@router.post("/payment/request")
def request_payment(user: dict = Depends(get_current_user)):
    """User clicks 'I've paid' — create a pending request and notify admin via Telegram."""
    sb   = get_supabase()
    plan = _get_plan(user["user_id"])

    if plan == "pro":
        raise HTTPException(400, "คุณใช้แผน Pro อยู่แล้ว")

    # Don't allow duplicate pending requests
    existing = (
        sb.table("payment_requests")
        .select("id")
        .eq("user_id", user["user_id"])
        .eq("status", "pending")
        .execute()
    )
    if existing.data:
        raise HTTPException(400, "มีคำขออยู่ระหว่างรอการอนุมัติแล้ว กรุณารอ")

    # Create request record
    new_req = (
        sb.table("payment_requests")
        .insert({"user_id": user["user_id"], "status": "pending"})
        .execute()
    )
    req_id = new_req.data[0]["id"]

    # Notify admin
    text = (
        f"\U0001f4b0 *Payment Request*\n"
        f"User: `{user['email']}`\n"
        f"Plan: Pro ({PRO_PRICE_THB} THB/mo)\n"
        f"Request ID: `{req_id[:8]}`\n\n"
        f"Reply *YES* to this message to approve."
    )
    msg_id = _tg_send(text)
    if msg_id:
        sb.table("payment_requests") \
          .update({"telegram_message_id": msg_id}) \
          .eq("id", req_id) \
          .execute()

    return {"status": "pending"}


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    """
    Telegram bot webhook.
    Admin replies YES (as a reply to the bot's payment notification message)
    → payment approved → user plan set to 'pro'.
    """
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    message   = body.get("message") or body.get("edited_message")
    if not message:
        return {"ok": True}

    text     = (message.get("text") or "").strip().upper()
    reply_to = message.get("reply_to_message")

    if text == "YES" and reply_to:
        original_msg_id = reply_to["message_id"]
        sb = get_supabase()

        result = (
            sb.table("payment_requests")
            .select("id, user_id")
            .eq("telegram_message_id", original_msg_id)
            .eq("status", "pending")
            .execute()
        )

        if result.data:
            req  = result.data[0]
            now  = datetime.now(timezone.utc).isoformat()

            sb.table("payment_requests").update({
                "status":      "approved",
                "approved_at": now,
            }).eq("id", req["id"]).execute()

            sb.table("profiles").update({"plan": "pro"}).eq("id", req["user_id"]).execute()

            # Confirmation back to admin
            _tg_send(f"✅ Approved! `{req['user_id'][:8]}...` upgraded to Pro.")

    return {"ok": True}
