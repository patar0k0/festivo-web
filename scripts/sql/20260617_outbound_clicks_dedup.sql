-- 24h dedup for outbound clicks. Adds visitor_hash (salted SHA-256 of
-- IP + User-Agent) for anonymous clicks; logged-in clicks dedup by user_id.
-- The /out route checks for an existing click in the last 24h for the same
-- (festival_id, destination_type) + actor before inserting. Indexes back
-- those lookups. Additive change; existing RLS policies are unchanged.
--
-- Apply this BEFORE deploying the matching app/out/route.ts change — the
-- route inserts the visitor_hash column, so deploying first would break
-- outbound-click recording until the column exists.

alter table public.outbound_clicks
  add column if not exists visitor_hash text;

create index if not exists outbound_clicks_user_dedup_idx
  on public.outbound_clicks (user_id, festival_id, destination_type, created_at desc)
  where user_id is not null;

create index if not exists outbound_clicks_visitor_dedup_idx
  on public.outbound_clicks (visitor_hash, festival_id, destination_type, created_at desc)
  where visitor_hash is not null;
