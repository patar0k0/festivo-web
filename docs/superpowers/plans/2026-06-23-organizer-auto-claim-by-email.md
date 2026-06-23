# Organizer Auto-Claim by Matching Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a logged-in user's confirmed email matches exactly one unclaimed, active organizer profile, automatically grant them `owner`/`active` membership on first visit to `/organizer` — no admin approval step — while notifying both the user and the admin.

**Architecture:** A single pure-ish helper function (`attemptOrganizerAutoClaimByEmail`) does the matching + grant + notify + audit-log work against a Supabase admin client. It is called from the existing `/organizer` landing page (`app/organizer/page.tsx`), the one place every logged-in non-owner user passes through. A new `admin-auto-claim-granted` email type (informational, no approval gate) is added alongside the existing email registry/schema/dedupe-key conventions, reusing the existing `organizer-claim-approved` type for the user-facing notification.

**Tech Stack:** Next.js App Router (server component), Supabase service-role client, existing `lib/email/*` job queue, `vitest` for tests (using the `vitest` `describe/it/expect` API — see note in Task 4).

**Spec:** `docs/superpowers/specs/2026-06-23-organizer-auto-claim-by-email-design.md`

---

## Task 1: New email job type — `admin-auto-claim-granted`

**Files:**
- Modify: `lib/email/emailJobTypes.ts`
- Modify: `lib/email/emailTypeCategory.ts`
- Modify: `lib/email/emailDedupeKeys.ts`
- Modify: `lib/email/emailSchemas.ts`
- Test: `lib/email/emailSchemas.test.ts` (new file)

- [ ] **Step 1: Write the failing test for the new payload parser**

Create `lib/email/emailSchemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAdminAutoClaimGrantedPayload } from "./emailSchemas";

describe("parseAdminAutoClaimGrantedPayload", () => {
  it("parses a valid payload", () => {
    const result = parseAdminAutoClaimGrantedPayload({
      organizerName: "Народно читалище \"Съгласие-2014\"",
      organizerSlug: "narodno-chitalishte-saglasie-2014",
      userId: "726fe361-1f8b-4929-8c13-e01b6e792258",
      userEmail: "syglasie_2014@abv.bg",
      organizerAdminUrl: "https://festivo.bg/admin/organizers/713b40df-09b1-4452-8617-8c6f4463c3b6/edit",
    });
    expect(result).toEqual({
      organizerName: "Народно читалище \"Съгласие-2014\"",
      organizerSlug: "narodno-chitalishte-saglasie-2014",
      userId: "726fe361-1f8b-4929-8c13-e01b6e792258",
      userEmail: "syglasie_2014@abv.bg",
      organizerAdminUrl: "https://festivo.bg/admin/organizers/713b40df-09b1-4452-8617-8c6f4463c3b6/edit",
    });
  });

  it("allows a null organizerSlug", () => {
    const result = parseAdminAutoClaimGrantedPayload({
      organizerName: "Test Org",
      organizerSlug: null,
      userId: "u1",
      userEmail: "a@b.bg",
      organizerAdminUrl: "https://festivo.bg/admin/organizers/x/edit",
    });
    expect(result.organizerSlug).toBeNull();
  });

  it("throws when organizerName is missing", () => {
    expect(() =>
      parseAdminAutoClaimGrantedPayload({
        userId: "u1",
        userEmail: "a@b.bg",
        organizerAdminUrl: "https://festivo.bg/admin/organizers/x/edit",
      }),
    ).toThrow("invalid_payload:missing_organizerName");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/email/emailSchemas.test.ts`
Expected: FAIL — `parseAdminAutoClaimGrantedPayload` is not exported from `./emailSchemas`.

- [ ] **Step 3: Add the job type constant**

In `lib/email/emailJobTypes.ts`, add after line 9 (`EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION`):

```ts
export const EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED = "admin-auto-claim-granted" as const;
```

Add it to the `EMAIL_JOB_TYPES` array (after `EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION` in the array, currently line 38):

```ts
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED,
```

- [ ] **Step 4: Add the category mapping**

In `lib/email/emailTypeCategory.ts`, add `EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED` to the import list (after `EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION` on line 5):

```ts
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED,
```

Add to `CATEGORY_BY_TYPE` (after the `EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION` line, currently line 38):

```ts
  [EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION]: "admin_alert",
  [EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED]: "admin_alert",
```

- [ ] **Step 5: Add dedupe key helpers**

In `lib/email/emailDedupeKeys.ts`, add `EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED` to the import (after `EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM` on line 2):

```ts
  EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
  EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED,
```

Add two new functions at the end of the file (after `dedupeKeyReminderSameDay`):

```ts
/** Reuses the existing organizer-claim-approved email type for the auto-claim path; keyed by organizer+user (no pre-existing member-row id at enqueue time). */
export function dedupeKeyOrganizerAutoClaimApproved(organizerId: string, userId: string) {
  return `${EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED}:auto:${organizerId}:${userId}`;
}

export function dedupeKeyAdminAutoClaimGranted(organizerId: string, userId: string) {
  return `${EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED}:${organizerId}:${userId}`;
}
```

- [ ] **Step 6: Add the payload type + parser**

In `lib/email/emailSchemas.ts`, add at the end of the file (after `parseAdminFestivalCancelledPayload`):

```ts
export type AdminAutoClaimGrantedPayload = {
  organizerName: string;
  organizerSlug: string | null;
  userId: string;
  userEmail: string;
  organizerAdminUrl: string;
};

export function parseAdminAutoClaimGrantedPayload(raw: Record<string, unknown>): AdminAutoClaimGrantedPayload {
  return {
    organizerName: reqString(raw, "organizerName", 400),
    organizerSlug: optString(raw, "organizerSlug", 200),
    userId: reqString(raw, "userId", 80),
    userEmail: reqString(raw, "userEmail", 320),
    organizerAdminUrl: reqString(raw, "organizerAdminUrl", 2000),
  };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run lib/email/emailSchemas.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add lib/email/emailJobTypes.ts lib/email/emailTypeCategory.ts lib/email/emailDedupeKeys.ts lib/email/emailSchemas.ts lib/email/emailSchemas.test.ts
git commit -m "feat(email): add admin-auto-claim-granted job type"
```

---

## Task 2: Email template for the admin notification

**Files:**
- Create: `emails/templates/AdminAutoClaimGrantedEmail.tsx`

No test for this file — no other template in `emails/templates/` has a test (presentation-only, verified visually via the existing `renderEmail` pipeline used by every other type).

- [ ] **Step 1: Create the template**

```tsx
import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  organizerName: string;
  userEmail: string;
  organizerAdminUrl: string;
};

export function AdminAutoClaimGrantedEmail({ siteUrl, organizerName, userEmail, organizerAdminUrl }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Автоматично предоставени права за организатор
      </Heading>
      <Text style={p}>
        Потвърден имейл на нов потребител съвпадна с имейла на неклеймнат организаторски
        профил — правата за собственик бяха дадени автоматично, без чакане за одобрение.
      </Text>
      <EmailSection>
        <EmailInfoRow label="Организатор" value={organizerName} />
        <EmailInfoRow label="Имейл на потребителя" value={userEmail} />
      </EmailSection>
      <EmailSection>
        <EmailButton href={organizerAdminUrl}>Преглед на профила в админа</EmailButton>
      </EmailSection>
    </BaseLayout>
  );
}

const h1: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  color: "#18181b",
};

const p: CSSProperties = {
  margin: "0 0 18px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the file isn't imported anywhere yet, so this just confirms the JSX/types are valid in isolation — Task 3 will surface any real wiring errors).

- [ ] **Step 3: Commit**

```bash
git add emails/templates/AdminAutoClaimGrantedEmail.tsx
git commit -m "feat(email): add AdminAutoClaimGrantedEmail template"
```

---

## Task 3: Register the new type in the email registry

**Files:**
- Modify: `lib/email/emailRegistry.ts`

- [ ] **Step 1: Add the imports**

Add to the template imports (after line 6, `AdminNewSubmissionEmail`):

```ts
import { AdminAutoClaimGrantedEmail } from "@/emails/templates/AdminAutoClaimGrantedEmail";
```

Add to the `emailJobTypes` import list (after `EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION` on line 25):

```ts
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED,
```

Add to the `emailSchemas` import list (after `parseAdminNewSubmissionPayload` on line 46):

```ts
  parseAdminNewSubmissionPayload,
  parseAdminAutoClaimGrantedPayload,
```

- [ ] **Step 2: Add the registry entry**

Add after the `EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION` entry (after line 251, before `[EMAIL_JOB_TYPE_CONTACT_FORM]`):

```ts
  [EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED]: {
    buildDefaultSubject: (pl) => {
      const p = parseAdminAutoClaimGrantedPayload(pl as Record<string, unknown>);
      return `Festivo админ — автоматични права: „${p.organizerName.slice(0, 60)}"`;
    },
    build: async (payload) => {
      const p = parseAdminAutoClaimGrantedPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const subject = `Festivo админ — автоматични права: „${p.organizerName.slice(0, 60)}"`;
      const { html, text } = await renderEmail(
        createElement(AdminAutoClaimGrantedEmail, {
          siteUrl,
          organizerName: p.organizerName,
          userEmail: p.userEmail,
          organizerAdminUrl: p.organizerAdminUrl,
        }),
      );
      return { subject, html, text };
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. `Record<EmailJobType, RegistryEntry>` requires every `EmailJobType` key to be present — if the new type was missing from `REGISTRY`, this step would fail with a TS2741/TS2739 error, confirming the type system is doing its job.

- [ ] **Step 4: Commit**

```bash
git add lib/email/emailRegistry.ts
git commit -m "feat(email): register admin-auto-claim-granted in the email registry"
```

---

## Task 4: Core matching + grant function

**Files:**
- Create: `lib/organizer/autoClaimOrganizersByEmail.ts`
- Test: `lib/organizer/autoClaimOrganizersByEmail.test.ts`

**Important — test framework note:** several existing test files in this repo (e.g. `lib/admin/poster/posterJobIdempotency.test.ts`) import `test`/`assert` from Node's built-in `node:test` module. Running `npm test` (which is `vitest run`) reports those files as **failed suites** ("No test suite found") even though every individual assertion inside them passes — this is a pre-existing defect in those files, not something to copy. Other test files in the repo (e.g. `lib/admin/__tests__/festivalDuplicates.test.ts`) correctly use `import { describe, it, expect } from "vitest"`, which vitest recognizes properly. **Use the `vitest` import style** for this new test file, matching `festivalDuplicates.test.ts`, not the broken `node:test` pattern.

- [ ] **Step 1: Write the failing tests**

Create `lib/organizer/autoClaimOrganizersByEmail.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { attemptOrganizerAutoClaimByEmail } from "./autoClaimOrganizersByEmail";

type Row = Record<string, unknown>;

/** Minimal chainable fake mimicking the subset of the supabase-js query builder this module uses. */
function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = vi.fn(chain);
  query.eq = vi.fn(chain);
  query.in = vi.fn(chain);
  query.ilike = vi.fn(chain);
  query.insert = vi.fn(() => Promise.resolve(result));
  query.update = vi.fn(chain);
  // The real builder is thenable; `await query` resolves to `{ data, error }` once all
  // filters are applied. We model that by making the chain itself awaitable.
  (query as PromiseLike<typeof result>).then = (resolve: (v: typeof result) => void) => resolve(result) as never;
  return query;
}

function makeAdmin(opts: {
  organizers: { data: Row[] | null; error: unknown };
  organizerMembersSelect: { data: Row[] | null; error: unknown };
  insertResult?: { error: unknown };
  updateResult?: { error: unknown };
}) {
  const calls: string[] = [];
  return {
    from(table: string) {
      calls.push(table);
      if (table === "organizers" && calls.filter((t) => t === "organizers").length === 1) {
        return makeQuery(opts.organizers);
      }
      if (table === "organizer_members" && !calls.includes("__member_insert_done__")) {
        // First organizer_members call = the owner-lookup select.
        if (calls.filter((t) => t === "organizer_members").length === 1) {
          return makeQuery(opts.organizerMembersSelect);
        }
        // Second organizer_members call = the insert.
        calls.push("__member_insert_done__");
        return makeQuery(opts.insertResult ?? { data: null, error: null });
      }
      if (table === "organizers") {
        // Second organizers call = the verified=true update.
        return makeQuery(opts.updateResult ?? { data: null, error: null });
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  } as never;
}

describe("attemptOrganizerAutoClaimByEmail", () => {
  it("returns claimed:false when no organizer matches the email", async () => {
    const admin = makeAdmin({
      organizers: { data: [], error: null },
      organizerMembersSelect: { data: [], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "nobody@example.bg");
    expect(result).toEqual({ claimed: false });
  });

  it("returns claimed:false when 2+ unclaimed organizers match the same email", async () => {
    const admin = makeAdmin({
      organizers: {
        data: [
          { id: "org-1", name: "Org One", slug: "org-one" },
          { id: "org-2", name: "Org Two", slug: "org-two" },
        ],
        error: null,
      },
      organizerMembersSelect: { data: [], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "shared@example.bg");
    expect(result).toEqual({ claimed: false });
  });

  it("returns claimed:false when the single matching organizer already has an active owner", async () => {
    const admin = makeAdmin({
      organizers: { data: [{ id: "org-1", name: "Org One", slug: "org-one" }], error: null },
      organizerMembersSelect: { data: [{ organizer_id: "org-1" }], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "claimed@example.bg");
    expect(result).toEqual({ claimed: false });
  });

  it("grants ownership when exactly one unclaimed organizer matches", async () => {
    const admin = makeAdmin({
      organizers: { data: [{ id: "org-1", name: "Org One", slug: "org-one" }], error: null },
      organizerMembersSelect: { data: [], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "Match@Example.BG");
    expect(result).toEqual({
      claimed: true,
      organizerId: "org-1",
      organizerName: "Org One",
      organizerSlug: "org-one",
    });
  });

  it("returns claimed:false (not throw) on a unique-violation race during insert", async () => {
    const admin = makeAdmin({
      organizers: { data: [{ id: "org-1", name: "Org One", slug: "org-one" }], error: null },
      organizerMembersSelect: { data: [], error: null },
      insertResult: { error: { code: "23505", message: "duplicate key" } },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "race@example.bg");
    expect(result).toEqual({ claimed: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/organizer/autoClaimOrganizersByEmail.test.ts`
Expected: FAIL — the module `./autoClaimOrganizersByEmail` does not exist yet.

- [ ] **Step 3: Implement the function**

Create `lib/organizer/autoClaimOrganizersByEmail.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  dedupeKeyAdminAutoClaimGranted,
  dedupeKeyOrganizerAutoClaimApproved,
} from "@/lib/email/emailDedupeKeys";
import { EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED, EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED } from "@/lib/email/emailJobTypes";
import { absoluteSiteUrl } from "@/lib/email/emailUrls";
import { enqueueAdminEmailJobSafe, enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";

export type OrganizerAutoClaimResult =
  | { claimed: false }
  | { claimed: true; organizerId: string; organizerName: string; organizerSlug: string | null };

type OrganizerCandidateRow = { id: string; name: string; slug: string | null };

/** Escapes `%`/`_`/`\` so a user-controlled email can't inject ilike wildcards. */
function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: string }).code === "23505";
  }
  return false;
}

/**
 * If `userEmail` exactly matches (case-insensitive) exactly one active, unclaimed
 * organizer profile's `email` field, grants the user `owner`/`active` membership on
 * that profile, marks it verified, and notifies the user + admin. No-ops on 0 or 2+
 * matches, or if the sole match already has an active owner (never adds a second
 * owner). See docs/superpowers/specs/2026-06-23-organizer-auto-claim-by-email-design.md.
 */
export async function attemptOrganizerAutoClaimByEmail(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<OrganizerAutoClaimResult> {
  const email = userEmail.trim().toLowerCase();
  if (!email) return { claimed: false };

  const { data: candidates, error: candidatesErr } = await admin
    .from("organizers")
    .select("id,name,slug")
    .eq("is_active", true)
    .ilike("email", escapeIlikeLiteral(email));

  if (candidatesErr) {
    console.error("[organizer_auto_claim] candidate lookup failed", { message: candidatesErr.message });
    return { claimed: false };
  }

  const candidateRows = (candidates ?? []) as OrganizerCandidateRow[];
  if (candidateRows.length === 0) return { claimed: false };

  const candidateIds = candidateRows.map((c) => c.id);
  const { data: ownerRows, error: ownerErr } = await admin
    .from("organizer_members")
    .select("organizer_id")
    .in("organizer_id", candidateIds)
    .eq("role", "owner")
    .eq("status", "active");

  if (ownerErr) {
    console.error("[organizer_auto_claim] owner lookup failed", { message: ownerErr.message });
    return { claimed: false };
  }

  const ownedIds = new Set((ownerRows ?? []).map((r) => r.organizer_id as string));
  const unclaimed = candidateRows.filter((c) => !ownedIds.has(c.id));
  if (unclaimed.length !== 1) return { claimed: false };

  const match = unclaimed[0];
  const nowIso = new Date().toISOString();

  const { error: insertErr } = await admin.from("organizer_members").insert({
    organizer_id: match.id,
    user_id: userId,
    role: "owner",
    status: "active",
    approved_at: nowIso,
    approved_by: userId,
  });

  if (insertErr) {
    if (isUniqueViolation(insertErr)) {
      // Already claimed concurrently (e.g. two rapid /organizer loads) — benign no-op.
      return { claimed: false };
    }
    console.error("[organizer_auto_claim] membership insert failed", { message: insertErr.message });
    return { claimed: false };
  }

  const { error: verifyErr } = await admin.from("organizers").update({ verified: true }).eq("id", match.id);
  if (verifyErr) {
    console.error("[organizer_auto_claim] verified flag update failed", { message: verifyErr.message });
  }

  void enqueueEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
      recipientEmail: email,
      recipientUserId: userId,
      payload: {
        organizerName: match.name,
        organizerSlug: match.slug ?? null,
        dashboardUrl: absoluteSiteUrl("/organizer/dashboard"),
      },
      dedupeKey: dedupeKeyOrganizerAutoClaimApproved(match.id, userId),
    },
    "organizer_auto_claim_user",
  );

  void enqueueAdminEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED,
      payload: {
        organizerName: match.name,
        organizerSlug: match.slug ?? null,
        userId,
        userEmail: email,
        organizerAdminUrl: absoluteSiteUrl(`/admin/organizers/${match.id}/edit`),
      },
      dedupeKey: dedupeKeyAdminAutoClaimGranted(match.id, userId),
    },
    "organizer_auto_claim_admin",
  );

  void logAdminAction({
    actor_user_id: userId,
    action: "organizer_auto_claim_by_email",
    entity_type: "organizer",
    entity_id: match.id,
    details: { email, organizer_name: match.name },
  });

  return { claimed: true, organizerId: match.id, organizerName: match.name, organizerSlug: match.slug ?? null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/organizer/autoClaimOrganizersByEmail.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck the whole project**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/organizer/autoClaimOrganizersByEmail.ts lib/organizer/autoClaimOrganizersByEmail.test.ts
git commit -m "feat(organizer): add auto-claim-by-email matching and grant logic"
```

---

## Task 5: Wire into the `/organizer` landing page

**Files:**
- Modify: `app/organizer/page.tsx:1-112`

- [ ] **Step 1: Update imports**

Current (lines 1-8):

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  fetchOrganizerPortalMembershipSummaryCached,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
```

Replace with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  fetchOrganizerPortalMembershipSummaryCached,
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import { attemptOrganizerAutoClaimByEmail } from "@/lib/organizer/autoClaimOrganizersByEmail";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
```

- [ ] **Step 2: Insert the auto-claim attempt**

Current (lines 96-112):

```tsx
export default async function OrganizerEntryPage() {
  const session = await getPortalSessionUser();
  const loggedIn = Boolean(session?.user?.id);

  let summary: Awaited<ReturnType<typeof fetchOrganizerPortalMembershipSummaryCached>> | null = null;
  if (loggedIn && session?.user?.id) {
    try {
      summary = await fetchOrganizerPortalMembershipSummaryCached(session.user.id);
    } catch {
      summary = null;
    }
  }

  // Active organizer owners go straight to their dashboard — they don't need this landing.
  if (loggedIn && summary?.isOrganizerOwner) {
    redirect("/organizer/dashboard");
  }
```

Replace with:

```tsx
export default async function OrganizerEntryPage() {
  const session = await getPortalSessionUser();
  const loggedIn = Boolean(session?.user?.id);

  let summary: Awaited<ReturnType<typeof fetchOrganizerPortalMembershipSummaryCached>> | null = null;
  if (loggedIn && session?.user?.id) {
    try {
      summary = await fetchOrganizerPortalMembershipSummaryCached(session.user.id);
    } catch {
      summary = null;
    }
  }

  // Active organizer owners go straight to their dashboard — they don't need this landing.
  if (loggedIn && summary?.isOrganizerOwner) {
    redirect("/organizer/dashboard");
  }

  // Not an owner yet — check whether the confirmed account email exactly matches one
  // unclaimed organizer profile, and auto-grant ownership if so. `redirect()` throws
  // internally, so it must run outside the try/catch below (a caught NEXT_REDIRECT
  // would silently swallow the navigation).
  // See docs/superpowers/specs/2026-06-23-organizer-auto-claim-by-email-design.md
  let autoClaimGranted = false;
  if (loggedIn && session?.user?.id && session.user.email) {
    try {
      const adminClient = getPortalAdminClient();
      const result = await attemptOrganizerAutoClaimByEmail(adminClient, session.user.id, session.user.email);
      autoClaimGranted = result.claimed;
    } catch (err) {
      console.error("[organizer_auto_claim] unexpected error on /organizer landing", err);
    }
  }
  if (autoClaimGranted) {
    redirect("/organizer/dashboard");
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: the new test files (`lib/email/emailSchemas.test.ts`, `lib/organizer/autoClaimOrganizersByEmail.test.ts`) appear under "Test Files ... passed". The pre-existing 5 `node:test`-based "failed suites" are unrelated and unchanged from before this work (confirmed in Task 4's framework note) — do not attempt to fix them as part of this plan.

- [ ] **Step 5: Manual verification checklist (cannot be scripted — needs a real Supabase session)**

This flow touches live auth + DB state, so verify by hand against a Supabase branch or staging project, not the preview tool (admin/auth-gated, per project convention):
1. Create an organizer profile with a known `email` and no owner (e.g. via the existing `/admin/ingest` research path, or a direct insert with no matching `organizer_members` row).
2. Sign up a new user with that exact email (case can differ, e.g. `Info@X.bg` vs `info@x.bg`) and confirm it.
3. Log in and visit `/organizer` — expect an immediate redirect to `/organizer/dashboard`.
4. Confirm in the DB: `organizer_members` has a new `owner`/`active` row for that user; `organizers.verified` is now `true`.
5. Confirm two `email_jobs` rows were enqueued: one `organizer-claim-approved` to the user, one `admin-auto-claim-granted` to `EMAIL_ADMIN`.
6. Confirm an `admin_audit_logs` row with `action = "organizer_auto_claim_by_email"`.
7. Repeat steps 1-2 with a **second** organizer profile sharing the same email (no owner) — visiting `/organizer` a second time as a *different* test user with that email should do nothing automatic (2+ candidates → skip), and should show the normal onboarding CTAs.

- [ ] **Step 6: Commit**

```bash
git add app/organizer/page.tsx
git commit -m "feat(organizer): auto-claim unclaimed organizer profile by matching email on /organizer landing"
```

---

## Task 6: Documentation sync

**Files:**
- Modify: `docs/system-architecture.md:337` (Organizer portal — Access bullet)
- Modify: `CLAUDE.md` (Organizer portal section)

Per this repo's documentation sync rule ("Architecture / flows → docs/system-architecture.md") and the requirement that CLAUDE.md updates land in the same commit as the architectural change.

- [ ] **Step 1: Add a bullet to `docs/system-architecture.md`**

Insert a new bullet right after the existing "**Access:**" bullet (currently `docs/system-architecture.md:337`), before "**API (session + service role after authorization):**":

```markdown
- **Auto-claim by matching email:** on `/organizer` landing, if a logged-in non-owner's confirmed account email exactly (case-insensitive) matches exactly one **active, unclaimed** (`organizer_members` has no `owner`/`active` row) organizer's `email` field, ownership is granted automatically — `owner`/`active` membership self-approved, `organizers.verified` set `true`, no admin approval step. 2+ matching organizers (duplicate `email` values) skip auto-grant entirely and fall back to the normal `/organizer/claim` flow. Notifies the user (`organizer-claim-approved` email) and admin (`admin-auto-claim-granted`, informational only) and writes an `admin_audit_logs` row (`organizer_auto_claim_by_email`). Implemented in `lib/organizer/autoClaimOrganizersByEmail.ts`. See `docs/superpowers/specs/2026-06-23-organizer-auto-claim-by-email-design.md`.
```

- [ ] **Step 2: Add a bullet to `CLAUDE.md`**

In `CLAUDE.md`, under the existing "## Organizer portal" section, add a new bullet at the end of that section:

```markdown
- **Auto-claim by matching email:** a new user's confirmed signup email matching exactly one unclaimed, active organizer's `email` field auto-grants `owner`/`active` membership on `/organizer` landing — no admin approval. See `docs/system-architecture.md` (Organizer portal — Auto-claim) and `lib/organizer/autoClaimOrganizersByEmail.ts`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/system-architecture.md CLAUDE.md
git commit -m "docs: document organizer auto-claim by matching email"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 2: Full test run**

Run: `npm test`
Expected: all new tests pass; no new failures beyond the 5 pre-existing `node:test`-based "failed suite" files unrelated to this work.

- [ ] **Step 3: Lint (if configured)**

Run: `npm run lint` (check `package.json` for the exact script name if different)
Expected: no new lint errors in the files touched by this plan.

- [ ] **Step 4: Push, open PR, merge**

Per `CLAUDE.md` git workflow: feature branch `feat/organizer-auto-claim-by-email`, conventional commit messages (already used per-task above), PR with the standard template, merge immediately after CI/typecheck/tests are clean.
