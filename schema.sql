-- ============================================================
-- nXuu Trading Journal — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Trades table
create table if not exists trades (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default now(),
  date       date not null,
  result     text check (result in ('win', 'loss', 'be')) not null,
  r_value    numeric(5,2) default 0,
  pnl_usd    numeric(10,2) default 0,
  notes      text,
  model      text,
  session    text check (session in ('asian', 'london', 'ny'))
);

-- Checklist steps table (per user, custom)
create table if not exists checklist_steps (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  position   integer not null default 0,
  section    text not null,
  title      text not null,
  created_at timestamp with time zone default now()
);

-- Entry models table (per user, custom)
create table if not exists entry_models (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  name       text not null,
  created_at timestamp with time zone default now()
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- Users can only see and edit their own data

alter table trades           enable row level security;
alter table checklist_steps  enable row level security;
alter table entry_models     enable row level security;

-- Trades policies
create policy "Users can view own trades"
  on trades for select using (auth.uid() = user_id);

create policy "Users can insert own trades"
  on trades for insert with check (auth.uid() = user_id);

create policy "Users can delete own trades"
  on trades for delete using (auth.uid() = user_id);

create policy "Users can update own trades"
  on trades for update using (auth.uid() = user_id);

-- Checklist steps policies
create policy "Users can view own steps"
  on checklist_steps for select using (auth.uid() = user_id);

create policy "Users can insert own steps"
  on checklist_steps for insert with check (auth.uid() = user_id);

create policy "Users can update own steps"
  on checklist_steps for update using (auth.uid() = user_id);

create policy "Users can delete own steps"
  on checklist_steps for delete using (auth.uid() = user_id);

-- Entry models policies
create policy "Users can view own models"
  on entry_models for select using (auth.uid() = user_id);

create policy "Users can insert own models"
  on entry_models for insert with check (auth.uid() = user_id);

create policy "Users can update own models"
  on entry_models for update using (auth.uid() = user_id);

create policy "Users can delete own models"
  on entry_models for delete using (auth.uid() = user_id);
