# Festival Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавяне на lifecycle cancellation flow — admin и organizer (owner) маркират фестивал като отменен, plan users получават email, public UI показва cancelled badge.

**Architecture:** Нова колона `lifecycle_state` в `festivals` (отделна от `status` за catalog moderation). Shared business logic в `lib/festival/cancelFestival.ts` — извикан от два отделни API endpoints (admin + organizer). Notification pipeline използва съществуващата `email_jobs` queue.

**Tech Stack:** Next.js 14 App Router · Supabase Postgres · TypeScript · React Email (`@react-email/components`) · `enqueueEmailJob` · `logAdminAction` · Upstash rate limit

**Spec:** `docs/superpowers/specs/2026-06-02-festival-cancellation-design.md`

---

## File Map

| Action | Path |
|---|---|
| **CREATE** | `scripts/sql/20260602_festival_lifecycle_state.sql` |
| **CREATE** | `lib/festival/cancelFestival.ts` |
| **CREATE** | `app/admin/api/festivals/[id]/cancel/route.ts` |
| **CREATE** | `app/admin/api/festivals/[id]/uncancel/route.ts` |
| **CREATE** | `app/api/organizer/festivals/[id]/cancel/route.ts` |
| **CREATE** | `emails/templates/FestivalCancelledEmail.tsx` |
| **CREATE** | `emails/templates/AdminFestivalCancelledEmail.tsx` |
| **CREATE** | `components/admin/FestivalCancelDialog.tsx` |
| **MODIFY** | `lib/email/emailJobTypes.ts` — add 2 new type constants |
| **MODIFY** | `lib/email/emailSchemas.ts` — add 2 new payload parsers |
| **MODIFY** | `lib/email/emailRegistry.ts` — register 2 new types |
| **MODIFY** | `lib/email/emailTypeCategory.ts` — categorize 2 new types |
| **MODIFY** | `lib/email/renderEmailJob.ts` — add `festival-cancelled` to OPTIONAL_LINK_TYPES |
| **MODIFY** | `app/admin/(protected)/festivals/[id]/page.tsx` — add cancel section |
| **MODIFY** | `app/festivals/[slug]/page.tsx` — cancelled banner + Schema.org eventStatus |
| **MODIFY** | `components/festivals/FestivalCard.tsx` — cancelled badge |
| **MODIFY** | `lib/festival/enqueueSavedFestivalReminderEmail.ts` — skip cancelled festivals |

---

## Task 1: Schema migration

**Files:**
- Create: `scripts/sql/20260602_festival_lifecycle_state.sql`

- [ ] **Step 1: Създай migration файла**

```sql
-- scripts/sql/20260602_festival_lifecycle_state.sql

-- Lifecycle state — отделно от status (catalog moderation).
-- 'active' е default; 'cancelled' означава отменен от admin/organizer.
-- Дизайнирано за бъдещо добавяне на 'postponed' без втора миграция.

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_announced_by uuid REFERENCES auth.users(id);

-- Partial index — само за cancelled (малка fraction от таблицата)
CREATE INDEX IF NOT EXISTS festivals_lifecycle_state_idx
  ON festivals(lifecycle_state)
  WHERE lifecycle_state <> 'active';

-- RLS: lifecycle_state е public readable (за listings/detail pages)
-- Не е нужна промяна на RLS — колоната е в съществуващата festivals таблица
-- и existing SELECT policies я покриват автоматично.
```

- [ ] **Step 2: Приложи миграцията в Supabase**

В Supabase Dashboard → SQL Editor → копирай и изпълни файла.

Провери с:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'festivals'
  AND column_name IN ('lifecycle_state','cancelled_at','cancellation_reason','cancellation_announced_by')
ORDER BY column_name;
```

Очакван резултат: 4 реда.

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/festival-cancellation
git add scripts/sql/20260602_festival_lifecycle_state.sql
git commit -m "chore(db): add lifecycle_state, cancelled_at, cancellation_reason to festivals"
```

---

## Task 2: Email type registration

**Files:**
- Modify: `lib/email/emailJobTypes.ts`
- Modify: `lib/email/emailSchemas.ts`
- Modify: `lib/email/emailTypeCategory.ts`
- Modify: `lib/email/renderEmailJob.ts`

- [ ] **Step 1: Добави типовете в `emailJobTypes.ts`**

Добави след последния `export const EMAIL_JOB_TYPE_*` ред (след ред 15):

```typescript
export const EMAIL_JOB_TYPE_FESTIVAL_CANCELLED = "festival-cancelled" as const;
export const EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED = "admin-festival-cancelled" as const;
```

Добави двата в `EMAIL_JOB_TYPES` array (след `EMAIL_JOB_TYPE_ORGANIZER_OUTREACH`):

```typescript
  EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
  EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED,
```

- [ ] **Step 2: Добави payload parsers в `emailSchemas.ts`**

Добави в края на файла:

```typescript
export type FestivalCancelledPayload = {
  festivalTitle: string;
  cityDisplay: string | null;
  originalDateDisplay: string;
  cancellationDateDisplay: string;
  cancellationReason: string;
  alternativesUrl: string;
  calendarUrl: string;
  unsubscribeUrl?: string | null;
  managePreferencesUrl?: string | null;
};

export function parseFestivalCancelledPayload(raw: Record<string, unknown>): FestivalCancelledPayload {
  return {
    festivalTitle: reqString(raw, "festivalTitle", 400),
    cityDisplay: optString(raw, "cityDisplay", 200),
    originalDateDisplay: reqString(raw, "originalDateDisplay", 200),
    cancellationDateDisplay: reqString(raw, "cancellationDateDisplay", 200),
    cancellationReason: reqString(raw, "cancellationReason", 500),
    alternativesUrl: reqString(raw, "alternativesUrl", 2000),
    calendarUrl: reqString(raw, "calendarUrl", 2000),
    unsubscribeUrl: optString(raw, "unsubscribeUrl", 2000),
    managePreferencesUrl: optString(raw, "managePreferencesUrl", 2000),
  };
}

export type AdminFestivalCancelledPayload = {
  festivalTitle: string;
  festivalAdminUrl: string;
  cancelledByType: "admin" | "organizer";
  cancelledByDisplay: string;
  organizerName: string | null;
  cancellationReason: string;
  planUsersCount: number;
  cancelledAt: string;
};

export function parseAdminFestivalCancelledPayload(raw: Record<string, unknown>): AdminFestivalCancelledPayload {
  const cancelledByType = raw.cancelledByType === "organizer" ? "organizer" : "admin";
  const planUsersCount = typeof raw.planUsersCount === "number" ? raw.planUsersCount : 0;
  return {
    festivalTitle: reqString(raw, "festivalTitle", 400),
    festivalAdminUrl: reqString(raw, "festivalAdminUrl", 2000),
    cancelledByType,
    cancelledByDisplay: reqString(raw, "cancelledByDisplay", 400),
    organizerName: optString(raw, "organizerName", 400),
    cancellationReason: reqString(raw, "cancellationReason", 500),
    planUsersCount,
    cancelledAt: reqString(raw, "cancelledAt", 100),
  };
}
```

- [ ] **Step 3: Категоризирай в `emailTypeCategory.ts`**

Добави imports:
```typescript
import {
  // ... existing imports ...
  EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
  EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED,
} from "./emailJobTypes";
```

Добави в `CATEGORY_BY_TYPE` обекта:
```typescript
  [EMAIL_JOB_TYPE_FESTIVAL_CANCELLED]: "required_transactional",
  [EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED]: "admin_alert",
```

- [ ] **Step 4: Добави `festival-cancelled` в OPTIONAL_LINK_TYPES в `renderEmailJob.ts`**

```typescript
import {
  EMAIL_JOB_TYPE_WELCOME,
  EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
  type EmailJobType,
} from "./emailJobTypes";

const OPTIONAL_LINK_TYPES: ReadonlySet<EmailJobType> = new Set<EmailJobType>([
  EMAIL_JOB_TYPE_WELCOME,
  EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
]);
```

- [ ] **Step 5: Провери TypeScript**

```bash
npx tsc --noEmit
```

Очакван резултат: без errors свързани с новите типове.

- [ ] **Step 6: Commit**

```bash
git add lib/email/emailJobTypes.ts lib/email/emailSchemas.ts lib/email/emailTypeCategory.ts lib/email/renderEmailJob.ts
git commit -m "feat(email): register festival-cancelled and admin-festival-cancelled email types"
```

---

## Task 3: Email templates

**Files:**
- Create: `emails/templates/FestivalCancelledEmail.tsx`
- Create: `emails/templates/AdminFestivalCancelledEmail.tsx`

- [ ] **Step 1: Създай `FestivalCancelledEmail.tsx`**

```tsx
// emails/templates/FestivalCancelledEmail.tsx
import { Heading, Hr, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  festivalTitle: string;
  cityDisplay: string | null;
  originalDateDisplay: string;
  cancellationDateDisplay: string;
  cancellationReason: string;
  alternativesUrl: string;
  calendarUrl: string;
  unsubscribeUrl?: string | null;
  managePreferencesUrl?: string | null;
};

export function FestivalCancelledEmail({
  siteUrl,
  festivalTitle,
  cityDisplay,
  originalDateDisplay,
  cancellationDateDisplay,
  cancellationReason,
  alternativesUrl,
  calendarUrl,
  unsubscribeUrl,
  managePreferencesUrl,
}: Props) {
  const optionalEmailLinks =
    unsubscribeUrl?.trim() && managePreferencesUrl?.trim()
      ? { unsubscribeUrl: unsubscribeUrl.trim(), managePreferencesUrl: managePreferencesUrl.trim() }
      : null;

  return (
    <BaseLayout siteUrl={siteUrl} optionalEmailLinks={optionalEmailLinks}>
      {/* Red accent bar — severity indicator */}
      <div style={accentBar} />

      <Heading as="h1" style={h1}>
        Фестивалът е отменен
      </Heading>

      <Text style={lead}>
        <strong>{festivalTitle}</strong> е в твоя план, но за съжаление е отменен.
      </Text>

      <EmailSection>
        <EmailInfoRow label="Дата" value={originalDateDisplay} />
        {cityDisplay ? <EmailInfoRow label="Място" value={cityDisplay} /> : null}
        <EmailInfoRow label="Отменен на" value={cancellationDateDisplay} />
      </EmailSection>

      {/* Cancellation reason */}
      <EmailSection>
        <div style={reasonBox}>
          <Text style={reasonLabel}>Причина от организатора:</Text>
          <Text style={reasonText}>{cancellationReason}</Text>
        </div>
      </EmailSection>

      {/* CTAs */}
      <EmailSection>
        <EmailButton href={alternativesUrl}>
          {cityDisplay ? `Виж други фестивали в ${cityDisplay} →` : "Разгледай каталога →"}
        </EmailButton>
      </EmailSection>

      <Text style={altCta}>
        Или{" "}
        <a href={calendarUrl} style={altCtaLink}>
          намери алтернативи в същия месец →
        </a>
      </Text>

      <Hr style={divider} />

      <Text style={footer}>
        Получаваш това съобщение, защото беше запазил{" "}
        <strong>{festivalTitle}</strong> в твоя план в Festivo.
      </Text>
    </BaseLayout>
  );
}

const accentBar: CSSProperties = {
  height: "4px",
  backgroundColor: "#dc2626",
  borderRadius: "2px",
  marginBottom: "28px",
};

const h1: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "24px",
  fontWeight: 700,
  lineHeight: "1.25",
  color: "#18181b",
};

const lead: CSSProperties = {
  margin: "0 0 20px",
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#3f3f46",
};

const reasonBox: CSSProperties = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "8px",
  padding: "16px 20px",
};

const reasonLabel: CSSProperties = {
  margin: "0 0 6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#991b1b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const reasonText: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  lineHeight: "1.55",
  color: "#7f1d1d",
};

const altCta: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "14px",
  color: "#71717a",
  textAlign: "center",
};

const altCtaLink: CSSProperties = {
  color: "#18181b",
  fontWeight: 600,
  textDecoration: "underline",
};

const divider: CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "24px 0 0",
};

const footer: CSSProperties = {
  margin: "16px 0 0",
  fontSize: "13px",
  lineHeight: "1.55",
  color: "#71717a",
};
```

- [ ] **Step 2: Създай `AdminFestivalCancelledEmail.tsx`**

```tsx
// emails/templates/AdminFestivalCancelledEmail.tsx
import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  festivalTitle: string;
  festivalAdminUrl: string;
  cancelledByType: "admin" | "organizer";
  cancelledByDisplay: string;
  organizerName: string | null;
  cancellationReason: string;
  planUsersCount: number;
  cancelledAt: string;
};

export function AdminFestivalCancelledEmail({
  siteUrl,
  festivalTitle,
  festivalAdminUrl,
  cancelledByType,
  cancelledByDisplay,
  organizerName,
  cancellationReason,
  planUsersCount,
  cancelledAt,
}: Props) {
  const cancelledByLabel =
    cancelledByType === "organizer"
      ? `Организатор — ${cancelledByDisplay}${organizerName ? ` (${organizerName})` : ""}`
      : `Админ — ${cancelledByDisplay}`;

  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Отменен фестивал
      </Heading>
      <Text style={lead}>
        Фестивалът <strong>{festivalTitle}</strong> беше маркиран като отменен.
      </Text>

      <EmailSection>
        <EmailInfoRow label="Фестивал" value={festivalTitle} />
        <EmailInfoRow label="Отменен от" value={cancelledByLabel} />
        <EmailInfoRow label="Засегнати потребители (план)" value={String(planUsersCount)} />
        <EmailInfoRow label="Отменен на" value={cancelledAt} />
        <EmailInfoRow label="Причина" value={cancellationReason} />
      </EmailSection>

      <EmailSection>
        <EmailButton href={festivalAdminUrl}>Отвори в Admin →</EmailButton>
      </EmailSection>
    </BaseLayout>
  );
}

const h1: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "1.3",
  color: "#18181b",
};

const lead: CSSProperties = {
  margin: "0 0 18px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};
```

- [ ] **Step 3: Commit**

```bash
git add emails/templates/FestivalCancelledEmail.tsx emails/templates/AdminFestivalCancelledEmail.tsx
git commit -m "feat(email): add FestivalCancelledEmail and AdminFestivalCancelledEmail templates"
```

---

## Task 4: Email registry entries

**Files:**
- Modify: `lib/email/emailRegistry.ts`

- [ ] **Step 1: Добави imports в `emailRegistry.ts`**

Добави към imports секцията:

```typescript
import { FestivalCancelledEmail } from "@/emails/templates/FestivalCancelledEmail";
import { AdminFestivalCancelledEmail } from "@/emails/templates/AdminFestivalCancelledEmail";
```

```typescript
import {
  // ...existing imports...
  EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
  EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED,
} from "./emailJobTypes";
```

```typescript
import {
  // ...existing imports...
  parseFestivalCancelledPayload,
  parseAdminFestivalCancelledPayload,
} from "./emailSchemas";
```

- [ ] **Step 2: Добави registry entries в `REGISTRY` обекта**

Добави след последния entry (след `EMAIL_JOB_TYPE_REMINDER_SAME_DAY`):

```typescript
  [EMAIL_JOB_TYPE_FESTIVAL_CANCELLED]: {
    buildDefaultSubject: (pl) => {
      const p = parseFestivalCancelledPayload(pl as Record<string, unknown>);
      return `⚠ „${p.festivalTitle.slice(0, 70)}" е отменен`;
    },
    build: async (payload) => {
      const p = parseFestivalCancelledPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const subject = `⚠ „${p.festivalTitle.slice(0, 70)}" е отменен`;
      const { html, text } = await renderEmail(
        createElement(FestivalCancelledEmail, {
          siteUrl,
          festivalTitle: p.festivalTitle,
          cityDisplay: p.cityDisplay,
          originalDateDisplay: p.originalDateDisplay,
          cancellationDateDisplay: p.cancellationDateDisplay,
          cancellationReason: p.cancellationReason,
          alternativesUrl: p.alternativesUrl,
          calendarUrl: p.calendarUrl,
          unsubscribeUrl: p.unsubscribeUrl ?? undefined,
          managePreferencesUrl: p.managePreferencesUrl ?? undefined,
        }),
      );
      return { subject, html, text };
    },
  },

  [EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED]: {
    buildDefaultSubject: (pl) => {
      const p = parseAdminFestivalCancelledPayload(pl as Record<string, unknown>);
      return `Festivo админ — отменен фестивал: „${p.festivalTitle.slice(0, 60)}"`;
    },
    build: async (payload) => {
      const p = parseAdminFestivalCancelledPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const subject = `Festivo админ — отменен фестивал: „${p.festivalTitle.slice(0, 60)}"`;
      const { html, text } = await renderEmail(
        createElement(AdminFestivalCancelledEmail, {
          siteUrl,
          festivalTitle: p.festivalTitle,
          festivalAdminUrl: p.festivalAdminUrl,
          cancelledByType: p.cancelledByType,
          cancelledByDisplay: p.cancelledByDisplay,
          organizerName: p.organizerName,
          cancellationReason: p.cancellationReason,
          planUsersCount: p.planUsersCount,
          cancelledAt: p.cancelledAt,
        }),
      );
      return { subject, html, text };
    },
  },
```

- [ ] **Step 3: Провери TypeScript**

```bash
npx tsc --noEmit
```

Без errors.

- [ ] **Step 4: Commit**

```bash
git add lib/email/emailRegistry.ts
git commit -m "feat(email): register festival-cancelled email types in registry"
```

---

## Task 5: Shared cancellation business logic

**Files:**
- Create: `lib/festival/cancelFestival.ts`

- [ ] **Step 1: Създай `cancelFestival.ts`**

```typescript
// lib/festival/cancelFestival.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueEmailJob } from "@/lib/email/enqueueEmail";
import { logAdminAction } from "@/lib/admin/audit-log";
import { getBaseUrl } from "@/lib/config/baseUrl";
import {
  EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
  EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED,
} from "@/lib/email/emailJobTypes";

export type CancelledByType = "admin" | "organizer";

export type CancelFestivalInput = {
  festivalId: string;
  reason: string;
  cancelledByUserId: string;
  cancelledByType: CancelledByType;
  cancelledByDisplayName: string;
  organizerName?: string | null;
};

export type CancelFestivalResult = {
  planUsersNotified: number;
  adminAlertSent: boolean;
};

function formatBgDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("bg-BG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Core cancellation business logic.
 * Caller is responsible for auth checks and rate limiting.
 * Uses admin client (service role) to bypass RLS.
 */
export async function cancelFestival(
  admin: SupabaseClient,
  input: CancelFestivalInput,
): Promise<CancelFestivalResult> {
  const { festivalId, reason, cancelledByUserId, cancelledByType, cancelledByDisplayName, organizerName } = input;

  // 1. Load festival — must exist and not already cancelled
  const { data: festival, error: fetchErr } = await admin
    .from("festivals")
    .select("id, title, status, lifecycle_state, start_date, city_id, organizer_id")
    .eq("id", festivalId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!festival) throw Object.assign(new Error("festival_not_found"), { statusCode: 404 });
  if (festival.lifecycle_state === "cancelled") {
    throw Object.assign(new Error("already_cancelled"), { statusCode: 409 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 2. Mark as cancelled
  const { error: updateErr } = await admin
    .from("festivals")
    .update({
      lifecycle_state: "cancelled",
      cancelled_at: nowIso,
      cancellation_reason: reason.trim(),
      cancellation_announced_by: cancelledByUserId,
      updated_at: nowIso,
    })
    .eq("id", festivalId);

  if (updateErr) throw new Error(updateErr.message);

  // 3. Delete pending reminders for this festival
  const { error: reminderErr } = await admin
    .from("user_plan_reminders")
    .delete()
    .eq("festival_id", festivalId)
    .eq("status", "pending");

  if (reminderErr) {
    console.error("[cancelFestival] reminder delete failed", { festivalId, message: reminderErr.message });
    // non-fatal: log and continue
  }

  // 4. Find plan users
  const { data: planRows, error: planErr } = await admin
    .from("user_plan_festivals")
    .select("user_id, users!inner(email)")
    .eq("festival_id", festivalId);

  if (planErr) throw new Error(planErr.message);

  const planUsers = (planRows ?? []).map((row) => ({
    userId: row.user_id as string,
    email: (row.users as { email: string } | null)?.email ?? null,
  })).filter((u) => Boolean(u.email));

  // 5. Build city name for CTAs
  let cityDisplay: string | null = null;
  let citySlug: string | null = null;
  if (festival.city_id) {
    const { data: city } = await admin
      .from("cities")
      .select("name, slug")
      .eq("id", festival.city_id)
      .maybeSingle();
    cityDisplay = city?.name ?? null;
    citySlug = city?.slug ?? null;
  }

  const base = getBaseUrl().replace(/\/$/, "");
  const alternativesUrl = citySlug
    ? `${base}/festivals?city=${citySlug}`
    : `${base}/festivals`;

  // Derive month from start_date for calendar CTA
  let calendarUrl = `${base}/calendar`;
  if (festival.start_date) {
    const month = festival.start_date.slice(0, 7); // YYYY-MM
    calendarUrl = `${base}/calendar?month=${month}`;
  }

  const originalDateDisplay = festival.start_date
    ? formatBgDate(festival.start_date)
    : "Дата не е посочена";
  const cancellationDateDisplay = formatBgDate(nowIso);
  const festivalAdminUrl = `${base}/admin/festivals/${festivalId}`;

  // 6. Enqueue user emails (per-user, idempotent)
  let notifiedCount = 0;
  for (const u of planUsers) {
    try {
      const result = await enqueueEmailJob(admin, {
        type: EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
        recipientEmail: u.email!,
        recipientUserId: u.userId,
        priority: "high",
        dedupeKey: `festival-cancelled:${festivalId}:${u.userId}`,
        payload: {
          festivalTitle: festival.title,
          cityDisplay,
          originalDateDisplay,
          cancellationDateDisplay,
          cancellationReason: reason.trim(),
          alternativesUrl,
          calendarUrl,
        },
      });
      if (result.outcome === "created") notifiedCount++;
    } catch (emailErr) {
      const message = emailErr instanceof Error ? emailErr.message : "unknown";
      console.error("[cancelFestival] email enqueue failed for user", { userId: u.userId, festivalId, message });
      // non-fatal: continue with remaining users
    }
  }

  // 7. Enqueue admin alert
  let adminAlertSent = false;
  const adminEmail = process.env.EMAIL_ADMIN?.trim();
  if (adminEmail) {
    try {
      await enqueueEmailJob(admin, {
        type: EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED,
        recipientEmail: adminEmail,
        priority: "normal",
        dedupeKey: `admin-festival-cancelled:${festivalId}:${nowIso.slice(0, 13)}`,
        payload: {
          festivalTitle: festival.title,
          festivalAdminUrl,
          cancelledByType,
          cancelledByDisplay: cancelledByDisplayName,
          organizerName: organizerName ?? null,
          cancellationReason: reason.trim(),
          planUsersCount: planUsers.length,
          cancelledAt: cancellationDateDisplay,
        },
      });
      adminAlertSent = true;
    } catch (alertErr) {
      const message = alertErr instanceof Error ? alertErr.message : "unknown";
      console.error("[cancelFestival] admin alert enqueue failed", { festivalId, message });
    }
  }

  // 8. Audit log
  try {
    await logAdminAction({
      actor_user_id: cancelledByUserId,
      action: cancelledByType === "organizer" ? "festival.cancelled_by_organizer" : "festival.cancelled",
      entity_type: "festival",
      entity_id: festivalId,
      route: cancelledByType === "organizer"
        ? "/api/organizer/festivals/[id]/cancel"
        : "/admin/api/festivals/[id]/cancel",
      method: "POST",
      details: {
        reason: reason.trim(),
        plan_users_notified: notifiedCount,
      },
    });
  } catch (auditErr) {
    const message = auditErr instanceof Error ? auditErr.message : "unknown";
    console.error("[cancelFestival] audit log failed", { festivalId, message });
  }

  return { planUsersNotified: notifiedCount, adminAlertSent };
}

/**
 * Reverses a cancellation. Admin only.
 * Does NOT send emails — user must manually re-add to plan.
 */
export async function uncancelFestival(
  admin: SupabaseClient,
  festivalId: string,
  adminUserId: string,
): Promise<void> {
  const { data: festival, error: fetchErr } = await admin
    .from("festivals")
    .select("id, lifecycle_state")
    .eq("id", festivalId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!festival) throw Object.assign(new Error("festival_not_found"), { statusCode: 404 });
  if (festival.lifecycle_state !== "cancelled") {
    throw Object.assign(new Error("not_cancelled"), { statusCode: 409 });
  }

  const { error: updateErr } = await admin
    .from("festivals")
    .update({
      lifecycle_state: "active",
      cancelled_at: null,
      cancellation_reason: null,
      cancellation_announced_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", festivalId);

  if (updateErr) throw new Error(updateErr.message);

  try {
    await logAdminAction({
      actor_user_id: adminUserId,
      action: "festival.uncancelled",
      entity_type: "festival",
      entity_id: festivalId,
      route: "/admin/api/festivals/[id]/uncancel",
      method: "POST",
      details: {},
    });
  } catch (auditErr) {
    const message = auditErr instanceof Error ? auditErr.message : "unknown";
    console.error("[uncancelFestival] audit log failed", { festivalId, message });
  }
}
```

- [ ] **Step 2: Провери TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/festival/cancelFestival.ts
git commit -m "feat(festival): add cancelFestival and uncancelFestival business logic"
```

---

## Task 6: Admin API endpoints

**Files:**
- Create: `app/admin/api/festivals/[id]/cancel/route.ts`
- Create: `app/admin/api/festivals/[id]/uncancel/route.ts`

- [ ] **Step 1: Създай admin cancel endpoint**

```typescript
// app/admin/api/festivals/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cancelFestival } from "@/lib/festival/cancelFestival";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: festivalId } = await params;

  let reason: string;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (reason.length < 20 || reason.length > 500) {
    return NextResponse.json(
      { error: "reason_invalid_length", min: 20, max: 500 },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();

  // Resolve display name for audit trail
  const displayName = ctx.user.email ?? ctx.user.id;

  try {
    const result = await cancelFestival(admin, {
      festivalId,
      reason,
      cancelledByUserId: ctx.user.id,
      cancelledByType: "admin",
      cancelledByDisplayName: displayName,
      organizerName: null,
    });

    return NextResponse.json({
      ok: true,
      festival_id: festivalId,
      plan_users_notified: result.planUsersNotified,
      admin_alert_sent: result.adminAlertSent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const statusCode =
      (err as { statusCode?: number }).statusCode ??
      (message === "festival_not_found" ? 404 : message === "already_cancelled" ? 409 : 500);

    if (statusCode >= 500) {
      console.error("[admin/cancel] unexpected error", { festivalId, message });
    }

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
```

- [ ] **Step 2: Създай admin uncancel endpoint**

```typescript
// app/admin/api/festivals/[id]/uncancel/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { uncancelFestival } from "@/lib/festival/cancelFestival";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: festivalId } = await params;
  const admin = createSupabaseAdmin();

  try {
    await uncancelFestival(admin, festivalId, ctx.user.id);
    return NextResponse.json({ ok: true, festival_id: festivalId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const statusCode =
      (err as { statusCode?: number }).statusCode ??
      (message === "festival_not_found" ? 404 : message === "not_cancelled" ? 409 : 500);

    if (statusCode >= 500) {
      console.error("[admin/uncancel] unexpected error", { festivalId, message });
    }

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
```

- [ ] **Step 3: Провери TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/api/festivals/[id]/cancel/route.ts app/admin/api/festivals/[id]/uncancel/route.ts
git commit -m "feat(admin): add festival cancel and uncancel API endpoints"
```

---

## Task 7: Organizer API endpoint

**Files:**
- Create: `app/api/organizer/festivals/[id]/cancel/route.ts`

- [ ] **Step 1: Провери как изглежда съществуващ organizer route за pattern**

```bash
cat app/api/organizer/pending-festivals/[id]/route.ts | head -60
```

- [ ] **Step 2: Създай organizer cancel endpoint**

```typescript
// app/api/organizer/festivals/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { cancelFestival } from "@/lib/festival/cancelFestival";

export const runtime = "nodejs";

// Rate limit: allow max 3 cancellations per user per 24h (Upstash)
// Omit if UPSTASH env vars are absent (non-fatal)
async function checkRateLimit(userId: string): Promise<{ limited: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { limited: false };

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis/cloudflare");
    const ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(3, "24 h"),
      prefix: "organizer-cancel",
    });
    const { success } = await ratelimit.limit(`organizer-cancel:${userId}`);
    return { limited: !success };
  } catch {
    return { limited: false };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getPortalSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: festivalId } = await params;

  let reason: string;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (reason.length < 20 || reason.length > 500) {
    return NextResponse.json(
      { error: "reason_invalid_length", min: 20, max: 500 },
      { status: 400 },
    );
  }

  const admin = getPortalAdminClient();

  // Verify festival exists and belongs to an organizer where user is owner
  const { data: festival, error: fetchErr } = await admin
    .from("festivals")
    .select("id, title, organizer_id, lifecycle_state")
    .eq("id", festivalId)
    .maybeSingle();

  if (fetchErr || !festival) {
    return NextResponse.json({ error: "festival_not_found" }, { status: 404 });
  }

  if (!festival.organizer_id) {
    return NextResponse.json({ error: "festival_has_no_organizer" }, { status: 403 });
  }

  // Check user is owner of the festival's organizer
  const { data: membership, error: memErr } = await admin
    .from("organizer_members")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("organizer_id", festival.organizer_id)
    .eq("status", "active")
    .eq("role", "owner")
    .maybeSingle();

  if (memErr || !membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit check
  const { limited } = await checkRateLimit(session.user.id);
  if (limited) {
    return NextResponse.json(
      { error: "rate_limited", message: "Вече сте отменили фестивал в последните 24 часа. Свържете се с admin@festivo.bg при нужда." },
      { status: 429 },
    );
  }

  // Load organizer name for audit/email
  const { data: organizer } = await admin
    .from("organizers")
    .select("name")
    .eq("id", festival.organizer_id)
    .maybeSingle();

  try {
    const result = await cancelFestival(admin, {
      festivalId,
      reason,
      cancelledByUserId: session.user.id,
      cancelledByType: "organizer",
      cancelledByDisplayName: session.user.email ?? session.user.id,
      organizerName: organizer?.name ?? null,
    });

    return NextResponse.json({
      ok: true,
      festival_id: festivalId,
      plan_users_notified: result.planUsersNotified,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const statusCode =
      (err as { statusCode?: number }).statusCode ??
      (message === "festival_not_found" ? 404 : message === "already_cancelled" ? 409 : 500);

    if (statusCode >= 500) {
      console.error("[organizer/cancel] unexpected error", { festivalId, message });
    }

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
```

- [ ] **Step 3: Провери TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/organizer/festivals/[id]/cancel/route.ts
git commit -m "feat(organizer): add festival cancel endpoint for owner role"
```

---

## Task 8: Admin UI — Cancel/Uncancel Dialog

**Files:**
- Create: `components/admin/FestivalCancelDialog.tsx`
- Modify: `app/admin/(protected)/festivals/[id]/page.tsx`

- [ ] **Step 1: Провери как изглежда admin festival detail page**

```bash
head -80 "app/admin/(protected)/festivals/[id]/page.tsx"
```

- [ ] **Step 2: Намери pattern за existing confirmation modal в admin**

```bash
grep -r "double.*confirm\|type.*to.*confirm\|confirmText\|typeToConfirm" components/admin/ --include="*.tsx" -l
```

- [ ] **Step 3: Създай `FestivalCancelDialog.tsx`**

```tsx
// components/admin/FestivalCancelDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "cancel" | "uncancel";

type Props = {
  festivalId: string;
  festivalTitle: string;
  lifecycleState: "active" | "cancelled";
  planUsersCount?: number;
};

export function FestivalCancelDialog({
  festivalId,
  festivalTitle,
  lifecycleState,
  planUsersCount = 0,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(lifecycleState === "cancelled" ? "uncancel" : "cancel");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reasonValid = reason.trim().length >= 20 && reason.trim().length <= 500;
  const confirmValid = confirmText.trim() === festivalTitle.trim();
  const canSubmit = mode === "uncancel" ? !isPending : (reasonValid && confirmValid && !isPending);

  async function handleSubmit() {
    setError(null);
    const url =
      mode === "cancel"
        ? `/admin/api/festivals/${festivalId}/cancel`
        : `/admin/api/festivals/${festivalId}/uncancel`;

    const body = mode === "cancel" ? JSON.stringify({ reason: reason.trim() }) : "{}";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const msg = typeof data.message === "string" ? data.message :
                  typeof data.error === "string" ? data.error : "Грешка";
      setError(msg);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (lifecycleState === "cancelled") {
    return (
      <div>
        <div style={{ padding: "12px 16px", background: "#fee2e2", borderRadius: 8, marginBottom: 12 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#991b1b" }}>⚠ Фестивалът е отменен</p>
        </div>
        <button
          onClick={() => { setMode("uncancel"); setOpen(true); }}
          style={{ padding: "8px 16px", background: "#f4f4f5", border: "1px solid #d4d4d8", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          Възстанови фестивала
        </button>

        {open && (
          <dialog open style={{ position: "fixed", inset: 0, zIndex: 50, background: "white", border: "1px solid #e4e4e7", borderRadius: 8, padding: 24, maxWidth: 480, margin: "auto", top: "20vh" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Възстанови фестивала?</h2>
            <p style={{ color: "#52525b", fontSize: 14 }}>Фестивалът ще бъде отново активен в каталога. Потребителите в плана не получават имейл — трябва ръчно да го добавят обратно.</p>
            {error && <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => { setOpen(false); setError(null); }} style={{ flex: 1, padding: "8px 0", background: "#f4f4f5", border: "1px solid #d4d4d8", borderRadius: 6, cursor: "pointer" }}>Откажи</button>
              <button
                onClick={() => startTransition(handleSubmit)}
                disabled={!canSubmit}
                style={{ flex: 1, padding: "8px 0", background: canSubmit ? "#18181b" : "#d4d4d8", color: "white", border: "none", borderRadius: 6, cursor: canSubmit ? "pointer" : "default" }}
              >
                {isPending ? "Зарежда…" : "Да, възстанови"}
              </button>
            </div>
          </dialog>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => { setMode("cancel"); setOpen(true); }}
        style={{ padding: "8px 16px", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontSize: 14, color: "#991b1b", fontWeight: 600 }}
      >
        Отмени фестивала
      </button>

      {open && (
        <dialog open style={{ position: "fixed", inset: 0, zIndex: 50, background: "white", border: "1px solid #e4e4e7", borderRadius: 8, padding: 24, maxWidth: 480, margin: "auto", top: "10vh" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#991b1b" }}>⚠ Отмени фестивала</h2>
          {planUsersCount > 0 && (
            <p style={{ margin: "0 0 16px", padding: "10px 14px", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 6, fontSize: 14, color: "#713f12" }}>
              <strong>{planUsersCount} потребител{planUsersCount !== 1 ? "и" : ""}</strong> са запазили този фестивал в плана си и ще получат имейл при потвърждаване.
            </p>
          )}

          <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Причина за отмяна *
            <span style={{ fontWeight: 400, color: "#71717a" }}> (20–500 символа)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Кратко обяснение за потребителите — напр. лошо време, организационни проблеми…"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d4d4d8", borderRadius: 6, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
          />
          <p style={{ margin: "4px 0 16px", fontSize: 12, color: reason.trim().length < 20 ? "#dc2626" : "#71717a" }}>
            {reason.trim().length} / 500 символа (минимум 20)
          </p>

          <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Въведи точното заглавие за потвърждение:
            <span style={{ display: "block", marginTop: 4, padding: "6px 10px", background: "#f4f4f5", borderRadius: 4, fontFamily: "monospace", fontSize: 13, fontWeight: 400 }}>
              {festivalTitle}
            </span>
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Въведи заглавието…"
            style={{ width: "100%", padding: "8px 12px", border: `1px solid ${confirmValid ? "#86efac" : "#d4d4d8"}`, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
          />

          {error && <p style={{ color: "#dc2626", fontSize: 14, marginTop: 12 }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={() => { setOpen(false); setError(null); setReason(""); setConfirmText(""); }} style={{ flex: 1, padding: "8px 0", background: "#f4f4f5", border: "1px solid #d4d4d8", borderRadius: 6, cursor: "pointer" }}>
              Откажи
            </button>
            <button
              onClick={() => startTransition(handleSubmit)}
              disabled={!canSubmit}
              style={{ flex: 1, padding: "8px 0", background: canSubmit ? "#dc2626" : "#d4d4d8", color: "white", border: "none", borderRadius: 6, cursor: canSubmit ? "pointer" : "default", fontWeight: 600 }}
            >
              {isPending ? "Отменя се…" : "Потвърди отмяната"}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Намери правилното място за добавяне на компонента в admin festival detail page**

Прочети `app/admin/(protected)/festivals/[id]/page.tsx` и намери sidebar section или action area.

- [ ] **Step 5: Добави `FestivalCancelDialog` в admin festival detail page**

Намери существуващ action бутон (като archive/restore). Добави след него:

```tsx
import { FestivalCancelDialog } from "@/components/admin/FestivalCancelDialog";

// В server component — вземи planUsersCount:
const { count: planUsersCount } = await supabase
  .from("user_plan_festivals")
  .select("*", { count: "exact", head: true })
  .eq("festival_id", festival.id);

// В JSX — след archive/restore бутоните:
<FestivalCancelDialog
  festivalId={festival.id}
  festivalTitle={festival.title}
  lifecycleState={(festival.lifecycle_state as "active" | "cancelled") ?? "active"}
  planUsersCount={planUsersCount ?? 0}
/>
```

- [ ] **Step 6: Провери TypeScript + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add components/admin/FestivalCancelDialog.tsx app/admin/"(protected)"/festivals/[id]/page.tsx
git commit -m "feat(admin): add FestivalCancelDialog in festival detail page"
```

---

## Task 9: Public UI — cancelled badge и banner

**Files:**
- Modify: `components/festivals/FestivalCard.tsx`
- Modify: `app/festivals/[slug]/page.tsx`

- [ ] **Step 1: Прочети FestivalCard компонента**

```bash
head -80 components/festivals/FestivalCard.tsx
```

- [ ] **Step 2: Добави cancelled badge в FestivalCard**

Намери Props type и добави `lifecycle_state?: string`. В JSX — добави badge над/върху card-а:

```tsx
{lifecycle_state === "cancelled" && (
  <div style={{
    position: "absolute",
    top: 8,
    right: 8,
    background: "#dc2626",
    color: "white",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 4,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    zIndex: 1,
  }}>
    ОТМЕНЕН
  </div>
)}
```

Ако card-ът ползва Tailwind (провери дали не е CSS-in-JS):

```tsx
{lifecycle_state === "cancelled" && (
  <span className="absolute top-2 right-2 z-10 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
    ОТМЕНЕН
  </span>
)}
```

- [ ] **Step 3: Прочети festival detail page**

```bash
head -100 "app/festivals/[slug]/page.tsx"
```

- [ ] **Step 4: Добави cancelled banner и Schema.org eventStatus**

Намери server component-а — добавен след SELECT query-то:

```tsx
// Cancelled banner — вмъкни преди hero секцията
{festival.lifecycle_state === "cancelled" && (
  <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-5 py-4">
    <p className="text-sm font-bold uppercase tracking-wide text-red-700">⚠ Фестивалът е отменен</p>
    {festival.cancellation_reason && (
      <p className="mt-1 text-sm text-red-900">{festival.cancellation_reason}</p>
    )}
    {festival.cancelled_at && (
      <p className="mt-1 text-xs text-red-500">
        Отменен на{" "}
        {new Date(festival.cancelled_at).toLocaleDateString("bg-BG", {
          day: "numeric", month: "long", year: "numeric",
        })}
      </p>
    )}
  </div>
)}
```

За Schema.org — намери JSON-LD секцията и добави:

```tsx
// В eventJsonLd обекта добави:
...(festival.lifecycle_state === "cancelled" && {
  eventStatus: "https://schema.org/EventCancelled",
})
```

- [ ] **Step 5: Провери build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add components/festivals/FestivalCard.tsx "app/festivals/[slug]/page.tsx"
git commit -m "feat(public): cancelled badge on FestivalCard, cancelled banner on festival detail"
```

---

## Task 10: Skip reminders за cancelled festivals

**Files:**
- Modify: `lib/festival/enqueueSavedFestivalReminderEmail.ts`

- [ ] **Step 1: Прочети файла**

```bash
cat lib/festival/enqueueSavedFestivalReminderEmail.ts
```

- [ ] **Step 2: Добави lifecycle_state check**

Намери SELECT query-то за festival данни. Добави `lifecycle_state` в SELECT полетата:

```typescript
const { data: festival, error } = await supabase
  .from("festivals")
  .select("id, title, start_date, start_time, lifecycle_state, ...")  // добави lifecycle_state
  .eq("id", festivalId)
  .maybeSingle();
```

Добави guard след null check:

```typescript
if (!festival) return { skipped: true, reason: "festival_not_found" };

// Skip ако фестивалът е отменен
if (festival.lifecycle_state === "cancelled") {
  return { skipped: true, reason: "festival_cancelled" };
}
```

- [ ] **Step 3: Провери build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/festival/enqueueSavedFestivalReminderEmail.ts
git commit -m "fix(reminders): skip reminder emails for cancelled festivals"
```

---

## Task 11: Final verification, PR и merge

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Очакван резултат: `✓ Compiled successfully`

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Очакван резултат: без errors.

- [ ] **Step 3: Ръчен smoke test — admin flow**

1. Отвори `/admin/festivals/[id]` за активен фестивал
2. Натисни „Отмени фестивала"
3. Въведи reason (>20 chars) + festivalTitle
4. Потвърди
5. Очаквано: page refresh, вместо Cancel бутон → „Възстанови" + red badge
6. Провери Supabase:
   ```sql
   SELECT id, title, lifecycle_state, cancelled_at, cancellation_reason
   FROM festivals WHERE id = '<id>';
   ```
7. Провери `email_jobs`:
   ```sql
   SELECT type, recipient_email, status FROM email_jobs
   WHERE dedupe_key LIKE 'festival-cancelled:<id>%'
   ORDER BY created_at DESC;
   ```

- [ ] **Step 4: Провери public UI**

Отвори `/festivals/[slug]` за отменения фестивал:
- Очаквано: червен banner с reason
- Провери source/Dev Tools → JSON-LD трябва да съдържа `"eventStatus":"https://schema.org/EventCancelled"`

- [ ] **Step 5: Обнови LAUNCH_CHECKLIST.md**

Добави нов item в Post-launch backlog ако не е там, или маркирай като done:

```markdown
- [x] Festival cancellation flow — admin + organizer cancel, plan user emails, public banner (feat/festival-cancellation)
```

- [ ] **Step 6: PR и merge**

```bash
git push -u origin feat/festival-cancellation
gh pr create \
  --title "feat(festival): cancellation flow — admin/organizer cancel, plan user emails, public banner" \
  --body "## Proposed Change
- **Summary:** Admin и organizer (owner role) може да маркират фестивал като отменен. Plan users получават branded email. Public detail page показва червен banner. Schema.org EventCancelled.
- **Why now:** User-protection — planned users трябваше да знаят за отмяна.

## Impacted Docs
- \`docs/superpowers/specs/2026-06-02-festival-cancellation-design.md\` (spec)
- \`docs/superpowers/plans/2026-06-02-festival-cancellation.md\` (this plan)

## Checklist
- [x] Schema: migration in scripts/sql/ with index + no RLS change needed
- [x] API contract: new endpoints only, no breaking changes
- [x] Background jobs: idempotent dedupe_key per user per festival
- [x] Security: admin route uses getAdminContext, organizer route verifies owner membership
- [x] Docs updated in this PR"
gh pr merge --merge --delete-branch
```

---

## Self-Review Results

**Spec coverage check:**
- ✅ lifecycle_state schema — Task 1
- ✅ Admin cancel endpoint — Task 6
- ✅ Admin uncancel endpoint — Task 6
- ✅ Organizer cancel endpoint — Task 7
- ✅ Organizer rate limit — Task 7
- ✅ Plan user email (FestivalCancelledEmail) — Tasks 3, 4, 5
- ✅ Admin alert email (AdminFestivalCancelledEmail) — Tasks 3, 4, 5
- ✅ Delete pending reminders — Task 5 (`cancelFestival.ts`)
- ✅ Admin UI modal — Task 8
- ✅ Public banner — Task 9
- ✅ Listing badge — Task 9
- ✅ Schema.org EventCancelled — Task 9
- ✅ Skip reminders for cancelled — Task 10
- ✅ Audit log — Task 5 (`cancelFestival.ts`)
- ✅ Email type registration (types, schemas, registry, category, renderEmailJob) — Tasks 2, 4
- ✅ Idempotency — Task 5 (`dedupe_key`)

**Type consistency check:**
- `CancelFestivalInput` defined in Task 5, used in Tasks 6 и 7 — ✅
- `EMAIL_JOB_TYPE_FESTIVAL_CANCELLED` defined in Task 2, used in Tasks 4 и 5 — ✅
- `parseFestivalCancelledPayload` defined in Task 2, used in Task 4 — ✅
- `FestivalCancelledEmail` props match `FestivalCancelledPayload` — ✅

**Organizer portal pattern:** Task 7 не ползва `requireOrganizerOwnerPortalSession` директно, а `getPortalSessionUser` + ръчен membership check — наследен от pattern в `app/api/organizer/pending-festivals/[id]/route.ts`. Consistent.
