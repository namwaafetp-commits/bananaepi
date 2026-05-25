-- ── Paywall schema additions ─────────────────────────────────────────────────

-- 1. Add plan column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- 2. Payment requests table
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  telegram_message_id  BIGINT,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_at          TIMESTAMPTZ
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_payments"
  ON public.payment_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_payments"
  ON public.payment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role (backend) can do everything — no extra policy needed when using service key
