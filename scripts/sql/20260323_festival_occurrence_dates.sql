-- Discrete festival days (e.g. 11th, 18th, 25th). When NULL or empty JSON array, use start_date/end_date as a continuous range.

alter table public.festivals
  add column if not exists occurrence_dates jsonb default null;

alter table public.pending_festivals
  add column if not exists occurrence_dates jsonb default null;

comment on column public.festivals.occurrence_dates is 'Sorted unique ISO date strings ["2025-06-11","2025-06-18"]. Null = use start_date/end_date range only.';

comment on column public.pending_festivals.occurrence_dates is 'Sorted unique ISO date strings for non-consecutive festival days.';

-- Public listing: festivals overlapping an inclusive date window (handles discrete days + legacy range).
create or replace function public.festivals_intersecting_range(p_from date, p_to date)
returns table (festival_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select f.id
  from public.festivals f
  where
    (f.status in ('published', 'verified') or f.is_verified is true)
    and (f.status is null or f.status <> 'archived')
    and (
      (
        (f.occurrence_dates is null or jsonb_typeof(f.occurrence_dates) <> 'array' or jsonb_array_length(coalesce(f.occurrence_dates, '[]'::jsonb)) = 0)
        and f.start_date is not null
        and f.start_date <= p_to
        and coalesce(f.end_date, f.start_date) >= p_from
      )
      or
      (
        f.occurrence_dates is not null
        and jsonb_typeof(f.occurrence_dates) = 'array'
        and jsonb_array_length(f.occurrence_dates) > 0
        and exists (
          select 1
          from jsonb_array_elements_text(f.occurrence_dates) as dt(val)
          where (dt.val)::date >= p_from and (dt.val)::date <= p_to
        )
      )
    );
$$;

grant execute on function public.festivals_intersecting_range(date, date) to anon, authenticated;
