# Organizer auto-claim by matching email

**Date:** 2026-06-23
**Status:** Approved, ready for implementation plan

## Problem

A user (`syglasie_2014@abv.bg`) self-created a brand-new organizer profile via the
self-service "create organizer" flow (`POST /api/organizer/organizers`), which grants
`owner`/`active` membership immediately with no admin review — by design, confirmed
acceptable in an earlier conversation.

Separately, organizer profiles can also be created **without** any user behind them yet:
self-created drafts, or profiles produced by the AI research/ingest pipeline with a
scraped `organizers.email` (from Facebook/website). These profiles sit unclaimed until
the real organizer signs up and goes through the existing `/organizer/claim` flow, which
requires admin approval (`organizer_members.status = "pending"` until an admin approves).

This is friction for the common case: the real organizer's email is already on file in
`organizers.email` (self-entered or scraped), and confirming an account with that exact
address is a reasonable proof of ownership — comparable to email-domain auto-join
patterns used elsewhere (Slack, GitHub org invites). We want to skip the manual claim +
admin-approval step in that specific case, while keeping it safe.

## Goals

- If a logged-in user's confirmed auth email matches exactly one unclaimed,
  active organizer profile's `email` field, grant them `owner`/`active` membership
  automatically — no admin approval step.
- Notify the user that they were granted access, and why.
- Give the admin passive visibility (informational email + audit log), not an approval
  gate.
- Never silently add a second owner to an already-claimed profile.
- Never guess when the match is ambiguous.

## Non-goals

- Re-checking already-claimed users for *additional* matching organizers that appear
  later (see Limitations).
- Reconciling stale `pending` claims left behind by other users for the same organizer
  (manual admin cleanup, see Edge Cases).
- Any change to the existing `/organizer/claim` flow (claiming an existing profile still
  requires admin approval when there's no email match, or when the email isn't the
  confirmed account email).

## Matching algorithm

Given a logged-in user with confirmed email `E`:

```
candidates = organizers
  WHERE is_active = true
    AND lower(trim(email)) = lower(trim(E))
    AND id NOT IN (
      organizer_members.organizer_id
      WHERE role = 'owner' AND status = 'active'
    )
```

- **0 candidates** → no-op.
- **Exactly 1 candidate** → auto-grant (see below).
- **2+ candidates** (duplicate organizer records sharing an email) → no-op, skip
  entirely. The user sees the normal `/organizer` CTAs ("Нов профил" / "Заявка за
  съществуващ"); nothing automatic happens. Ambiguous matches are never auto-resolved.

Email comparison is case-insensitive and trimmed. The literal email value is escaped for
`%`/`_` before use in the `ilike` filter (no wildcard injection from user-controlled
email strings).

## Auto-grant steps (exactly 1 candidate)

1. `INSERT organizer_members` — `organizer_id`, `user_id`, `role: "owner"`,
   `status: "active"`, `approved_at: now()`, `approved_by: <user_id>` (self-approved,
   same shape as the existing self-service "create organizer" flow).
2. `UPDATE organizers SET verified = true WHERE id = <organizer_id>` — taking ownership
   via a confirmed matching email is treated as the verification act itself (explicit
   product decision: verification should follow from real ownership, not precede it,
   regardless of whether the profile was admin-created or scraped).
3. Enqueue email to the user — reuse `EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED` (existing
   type; semantics already match: "you now have access to organizer profile X").
4. Enqueue a new informational admin email type `admin-auto-claim-granted`
   (`admin_alert` category, no action implied) — register in `emailJobTypes.ts`,
   `emailTypeCategory.ts`, `emailRegistry.ts`, `emailSchemas.ts` per the existing
   registration convention. Payload: organizer name/slug, claiming user id/email,
   timestamp.
5. Write `admin_audit_logs` row — `action: "organizer_auto_claim_by_email"`,
   `actor_user_id: <user_id>`, `entity_type: "organizer"`, `entity_id: <organizer_id>`,
   `details: { email, organizer_name }`. Gives a trace even if the email never lands.
6. All of the above run inside a try/catch that treats a duplicate-key error on the
   membership insert as a benign no-op (idempotent if the user reloads `/organizer`
   quickly twice — the membership row from the first run already exists, so the second
   run's candidate query returns 0 candidates and does nothing further).

## Where this runs

`app/organizer/page.tsx` (`OrganizerEntryPage`) — the `/organizer` landing page every
logged-in user without active organizer ownership reaches before the existing
`isOrganizerOwner` redirect to `/organizer/dashboard` ([page.tsx:96-112](../../../app/organizer/page.tsx)).
The auto-claim attempt runs once per page load, only when `loggedIn && session?.user?.id`
is true and the user is not already an owner. On a successful grant, redirect to
`/organizer/dashboard` immediately instead of rendering the landing page (same as the
existing owner-redirect path).

No other organizer portal page is touched — `lib/organizer/portal.ts`'s
`getPortalSessionUser()` is called from many pages and is not the right place for a
side-effecting DB write on every call.

## Limitations (accepted)

Once a user becomes an owner of *any* organizer, they never hit this landing page again
(immediate redirect to dashboard), so a new unclaimed organizer profile created later
with their matching email will **not** be auto-granted. They'd need the normal
`/organizer/claim` flow for that second profile. Acceptable for v1; revisit if it becomes
a recurring complaint.

## Edge cases

- **Stale `pending` claim from a different user:** if another user already has a
  `pending` claim on the organizer (via the existing `/organizer/claims` flow) and the
  *real* email owner then triggers auto-grant, auto-grant proceeds normally (creates the
  `active` owner row) but does **not** touch the other user's `pending` row. The admin
  will see it in `/admin/organizer-claims` as pending for a profile that already has an
  owner and must reject it manually. No automatic reconciliation — rare case, not worth
  the complexity.
- **Multiple emails on one auth user:** not applicable — Supabase auth has one primary
  email per user; we use whatever is on the session at the time of the check.
- **OAuth (Google/Apple) signups:** their email is already confirmed at signup, so they
  hit the same check the first time they land on `/organizer` post-login — no special
  casing needed.

## Testing notes

- Unit test the candidate-matching query logic (0 / 1 / 2+ candidates) against a seeded
  set of organizers with case-variant and whitespace-variant emails.
- Integration test: full auto-grant path writes membership + verified flag + both email
  jobs + audit log row in one pass.
- Integration test: duplicate-candidate case leaves everything untouched.
- Integration test: re-running the check after a successful grant is a no-op (idempotency).
- Manual check: confirm `/organizer` still renders normal CTAs for users with 0 or 2+
  candidate matches.
