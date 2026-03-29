-- Multi-organizer drafts: ordered entries with optional linked organizer_id (catalog) or name-only (research / resolve on approve).
alter table public.pending_festivals
  add column if not exists organizer_entries jsonb;

comment on column public.pending_festivals.organizer_entries is
  'Ordered organizers for moderation: json array of { "organizer_id": uuid|null, "name": string }. Legacy organizer_name / organizer_id still supported.';

update public.pending_festivals
set organizer_entries = case
  when organizer_id is not null then
    jsonb_build_array(
      jsonb_build_object(
        'organizer_id',
        organizer_id::text,
        'name',
        case
          when organizer_name is not null and trim(organizer_name) <> '' then trim(organizer_name)
          else '—'
        end
      )
    )
  when organizer_name is not null and trim(organizer_name) <> '' then
    jsonb_build_array(jsonb_build_object('name', trim(organizer_name)))
  else organizer_entries
end
where organizer_entries is null
  and (organizer_id is not null or (organizer_name is not null and trim(organizer_name) <> ''));
