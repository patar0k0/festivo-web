-- Allow authenticated admins and linked organizer portal members to SELECT non-catalog
-- `festivals` rows (preview), without changing anonymous/public catalog access.
--
-- Catalog visibility in app code: published / verified / is_verified, not archived/rejected
-- (see `lib/festival/editorOpenAction.ts`). `pending_festivals.status=approved` is moderation state;
-- published rows use `festivals.status` / `is_verified`.
--
-- Idempotent: replaces the named policy only.

alter table public.festivals enable row level security;

drop policy if exists "festivals_select_preview_admin_organizers" on public.festivals;

create policy "festivals_select_preview_admin_organizers"
  on public.festivals
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.organizer_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
        and (
          (festivals.organizer_id is not null and om.organizer_id = festivals.organizer_id)
          or exists (
            select 1
            from public.festival_organizers fo
            where fo.festival_id = festivals.id
              and fo.organizer_id = om.organizer_id
          )
        )
    )
  );
