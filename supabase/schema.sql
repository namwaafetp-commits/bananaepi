-- ============================================================
-- EpiAssist — Supabase Schema
-- Run this in Supabase → SQL Editor
-- ============================================================

-- ── Profiles (auto-created on sign-up) ──────────────────────
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile row on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Projects ────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  original_filename text,
  status text default 'pending_mapping',
  upload_time timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

alter table public.projects enable row level security;

create policy "Users view own projects"
  on public.projects for select using (auth.uid() = user_id);

create policy "Users insert own projects"
  on public.projects for insert with check (auth.uid() = user_id);

create policy "Users update own projects"
  on public.projects for update using (auth.uid() = user_id);

create policy "Users delete own projects"
  on public.projects for delete using (auth.uid() = user_id);

-- ── Share links ─────────────────────────────────────────────
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  token text unique not null,
  password_hash text not null,
  salt text not null,
  project_name text,
  expires_at timestamptz not null,
  snapshot jsonb,
  created_at timestamptz default now()
);

alter table public.share_links enable row level security;

-- Anyone can read a share link (to check expiry / verify password)
create policy "Anyone reads share links"
  on public.share_links for select using (true);

-- Only project owner can create a share link
create policy "Project owners insert share links"
  on public.share_links for insert with check (
    exists (
      select 1 from public.projects
      where id = project_id and user_id = auth.uid()
    )
  );

-- ── Storage buckets (run separately or via dashboard) ───────
-- These cannot be created via SQL — create in Supabase Dashboard:
--   Storage → New bucket → "project-files"   (private)
--   Storage → New bucket → "project-cleaned" (private)
--   Storage → New bucket → "project-outputs" (private)
