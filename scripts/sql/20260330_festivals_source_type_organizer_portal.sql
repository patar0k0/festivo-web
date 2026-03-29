-- Allow organizer portal publishes to persist source_type=organizer_portal on public.festivals
-- (pending_festivals.submission_source remains the primary portal traceability column).

alter table public.festivals
  drop constraint if exists festivals_source_type_check;

alter table public.festivals
  add constraint festivals_source_type_check
  check (
    source_type is null
    or source_type = any (
      array[
        'scraped'::text,
        'manual'::text,
        'claimed'::text,
        'facebook'::text,
        'facebook_event'::text,
        'organizer_portal'::text
      ]
    )
  );
