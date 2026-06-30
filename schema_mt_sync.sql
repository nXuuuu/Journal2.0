-- ============================================================
-- nXuu Trading Journal — MT4/5 EA Sync Migration
-- Run this in Supabase SQL Editor (after schema.sql)
-- ============================================================

-- ── TRADES: add API-source columns ──────────────────────────
alter table trades add column if not exists source       text default 'manual' check (source in ('manual','api'));
alter table trades add column if not exists ticket        bigint;
alter table trades add column if not exists symbol        text;
alter table trades add column if not exists direction     text check (direction in ('buy','sell'));
alter table trades add column if not exists entry_price   numeric(14,5);
alter table trades add column if not exists exit_price    numeric(14,5);
alter table trades add column if not exists lot_size      numeric(10,2);
alter table trades add column if not exists open_time     timestamptz;
alter table trades add column if not exists close_time    timestamptz;

-- Dedup key: one ticket per user, only enforced when ticket is set
create unique index if not exists trades_user_ticket_unique
  on trades(user_id, ticket) where ticket is not null;

-- ── SYNC KEYS ─────────────────────────────────────────────────
-- One per user. EA sends this in a header to authenticate.
-- We store only a hash — never the raw key.
create table if not exists sync_keys (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null unique,
  key_hash   text not null,
  created_at timestamptz default now()
);

alter table sync_keys enable row level security;

create policy "Users manage own sync key"
  on sync_keys for all using (auth.uid() = user_id);

-- Note: the Edge Function uses the service_role key, which bypasses RLS,
-- so it can look up sync_keys by hash across all users to identify who's syncing.
