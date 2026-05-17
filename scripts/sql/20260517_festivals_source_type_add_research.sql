-- Add 'research' as a valid source_type value for the festivals table.
-- Previously the check constraint only allowed: scraped, manual, claimed,
-- facebook, facebook_event, organizer_portal.
-- The research pipeline now produces source_type = 'research', which caused
-- an insert failure when approving a pending festival from that pipeline.

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
        'research'::text,
        'claimed'::text,
        'facebook'::text,
        'facebook_event'::text,
        'organizer_portal'::text
      ]
    )
  );
