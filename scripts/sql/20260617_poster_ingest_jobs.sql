-- Queue + audit + duplicate-confirm state for the Telegram poster-ingest bot.
-- One row per poster submission. Service-role only (RLS denies anon/auth).
-- Whitelist for the bot reuses the existing social_repost_allowed_users table.

create table if not exists public.poster_ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  tg_file_id text not null,
  tg_file_unique_id text not null,
  -- queued | processing | awaiting_dup_confirm | done | error | cancelled
  status text not null default 'queued',
  extraction_json jsonb,
  dup_matches jsonb,
  pending_festival_id uuid,
  error text,
  -- sha256(chatId::file_unique_id)[0:32] — prevents reprocessing the same poster.
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists poster_ingest_jobs_dedupe_key_uq
  on public.poster_ingest_jobs (dedupe_key);
create index if not exists poster_ingest_jobs_status_idx
  on public.poster_ingest_jobs (status);
create index if not exists poster_ingest_jobs_chat_idx
  on public.poster_ingest_jobs (telegram_chat_id, created_at desc);

alter table public.poster_ingest_jobs enable row level security;

-- No policies for anon/authenticated → only the service-role key (which bypasses
-- RLS) can read/write. Mirrors social_repost_jobs.
