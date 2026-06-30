-- CNC Voice Agent (Полимета C) — фаза 1
-- Входящ AI гласов агент: квалификация на купувачи + FAQ + трансфер/callback.
-- Таблици за обажданията (`voice_calls`) и квалифицираните leads (`voice_leads`).
--
-- Достъп: пише се само от server-only webhook endpoint-ите (Retell -> Next.js),
-- които ползват service-role клиента. Затова RLS е включен БЕЗ публични политики
-- (anon/authenticated се отказват по подразбиране; service role bypass-ва RLS).
--
-- Namespace `voice_` нарочно — за да не се сблъскват generic имената `calls`/`leads`
-- с останалата festival схема.

-- ---------------------------------------------------------------------------
-- voice_leads — квалифициран купувач, извлечен от разговора
-- ---------------------------------------------------------------------------
create table if not exists public.voice_leads (
  id                   uuid primary key default gen_random_uuid(),
  name                 text,
  company              text,
  city                 text,
  -- струг / фреза / обработващ център / тръбоогъваща / окомплектовка /
  -- измервателни инструменти / резервни части / друго
  machine_type         text,
  material             text,                       -- стомана / алуминий / неръждавейка / друго
  part_size            text,                       -- диаметър / дължина / тегло (свободен текст)
  condition            text,                       -- нова / употребявана
  budget               text,                       -- диапазон (свободен текст)
  timeline             text,                       -- сега / до 3 мес / проучва
  shop_ready           jsonb,                      -- { "ток": bool, "място": bool, "кран": bool }
  preferred_origin     text,                       -- китайски / турски / европейски / без значение
  qualification_score  integer not null default 0
                         check (qualification_score between 0 and 100),
  status               text not null default 'cold'
                         check (status in ('hot', 'warm', 'cold')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.voice_leads is
  'CNC гласов агент: квалифициран купувач/lead, извлечен от обаждане. Service-role only.';
comment on column public.voice_leads.qualification_score is
  '0–100, изчислен от LLM. Праг: >=70 hot, 50–69 warm, <50 cold.';
comment on column public.voice_leads.shop_ready is
  'Готовност на цеха: { ток (3-фазен), място, кран за разтоварване }.';

create index if not exists voice_leads_status_idx
  on public.voice_leads (status);
create index if not exists voice_leads_score_idx
  on public.voice_leads (qualification_score desc);
create index if not exists voice_leads_created_at_idx
  on public.voice_leads (created_at desc);

-- ---------------------------------------------------------------------------
-- voice_calls — едно входящо обаждане (1 lead може да има 0..N обаждания)
-- ---------------------------------------------------------------------------
create table if not exists public.voice_calls (
  id              uuid primary key default gen_random_uuid(),
  phone           text,
  started_at      timestamptz,
  duration_sec    integer check (duration_sec is null or duration_sec >= 0),
  transcript      text,
  summary         text,
  recording_url   text,
  outcome         text
                    check (outcome is null or outcome in
                      ('qualified', 'callback', 'transferred', 'cold')),
  language        text not null default 'bg',
  lead_id         uuid references public.voice_leads (id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.voice_calls is
  'CNC гласов агент: запис на едно входящо обаждане (транскрипт, резюме, изход). Service-role only.';
comment on column public.voice_calls.outcome is
  'qualified / callback / transferred / cold.';

create index if not exists voice_calls_phone_idx
  on public.voice_calls (phone);
create index if not exists voice_calls_started_at_idx
  on public.voice_calls (started_at desc);
create index if not exists voice_calls_lead_id_idx
  on public.voice_calls (lead_id);
create index if not exists voice_calls_outcome_idx
  on public.voice_calls (outcome);

-- ---------------------------------------------------------------------------
-- updated_at trigger за voice_leads
-- ---------------------------------------------------------------------------
create or replace function public.set_voice_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists voice_leads_set_updated_at on public.voice_leads;
create trigger voice_leads_set_updated_at
  before update on public.voice_leads
  for each row
  execute function public.set_voice_leads_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — включено, без публични политики.
-- Само service-role клиентът (webhook endpoint-ите) пише/чете; той bypass-ва RLS.
-- anon / authenticated нямат достъп (deny-all по подразбиране).
-- ---------------------------------------------------------------------------
alter table public.voice_leads enable row level security;
alter table public.voice_calls enable row level security;
