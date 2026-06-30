-- ============================================================
-- nXuu v6 — Additional schema for Leaderboard
-- Run this in Supabase SQL Editor (in addition to schema.sql)
-- ============================================================

-- Leaderboard RPC function
-- Returns aggregated stats for all users.
-- Only users who opt-in client-side appear (opt-in is stored in localStorage,
-- so all users are technically visible unless you add a DB opt-in column).
-- To add proper DB opt-in, uncomment the user_preferences section below.

create or replace function get_leaderboard()
returns table (
  user_id      uuid,
  email        text,
  display_name text,
  total_trades bigint,
  win_rate     numeric,
  total_pnl    numeric
)
language sql
security definer
as $$
  select
    t.user_id,
    au.email,
    au.raw_user_meta_data->>'display_name' as display_name,
    count(*)                                as total_trades,
    round(
      sum(case when t.result = 'win' then 1 else 0 end)::numeric
      / nullif(count(*), 0) * 100,
    1)                                      as win_rate,
    sum(t.pnl_usd)                          as total_pnl
  from trades t
  join auth.users au on au.id = t.user_id
  group by t.user_id, au.email, au.raw_user_meta_data
  having count(*) >= 1
  order by win_rate desc;
$$;

-- Grant access to authenticated users
grant execute on function get_leaderboard() to authenticated;
