-- Mirror of admin-saved program JSON on published festivals (backup + public fallback when schedule rows are empty).
-- Idempotent.

alter table public.festivals
  add column if not exists program_draft jsonb;

comment on column public.festivals.program_draft is
  'Last saved program from admin ProgramDraftEditor (compact shape). Also written when schedule is replaced from admin API.';
