# Festival Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавяне на функция за сигнализиране на проблеми с фестивали — бутон в rail-а на страницата на фестивала отваря modal с категория + текст + Turnstile; записва в `festival_reports` и изпраща имейл до admin.

**Architecture:** Публичен API route (`POST /api/festivals/[id]/report`) валидира Turnstile, rate-limit-ва по IP, записва в нова таблица `festival_reports` чрез service role client, и enqueue-ва admin имейл. Admin вижда сигналите на `/admin/festival-reports` и може да ги маркира разгледани.

**Tech Stack:** Next.js 14 App Router · Supabase Postgres · Cloudflare Turnstile · Upstash Redis · React Email · Tailwind

---

## File Map

| Файл | Действие | Роля |
|---|---|---|
| `scripts/sql/20260524_festival_reports.sql` | Create | Migration |
| `lib/email/emailJobTypes.ts` | Modify | Добавя `admin-festival-report` константа |
| `lib/email/emailSchemas.ts` | Modify | Добавя payload тип + parser |
| `emails/templates/AdminFestivalReportEmail.tsx` | Create | React Email template |
| `lib/email/emailRegistry.ts` | Modify | Регистрира новия email тип |
| `app/api/festivals/[id]/report/route.ts` | Create | Публичен POST endpoint |
| `app/admin/api/festival-reports/route.ts` | Create | Admin GET (list) |
| `app/admin/api/festival-reports/[id]/route.ts` | Create | Admin PATCH (mark reviewed) |
| `app/admin/(protected)/festival-reports/page.tsx` | Create | Admin UI страница |
| `components/festival/ReportFestivalModal.tsx` | Create | Client modal компонент |
| `components/festival/FestivalDetailActions.tsx` | Modify | Добавя бутон + modal в rail-а |

---

## Task 1: SQL Migration

**Files:**
- Create: `scripts/sql/20260524_festival_reports.sql`

- [ ] **Step 1: Напиши migration файла**

```sql
-- scripts/sql/20260524_festival_reports.sql

create table if not exists public.festival_reports (
  id           uuid primary key default gen_random_uuid(),
  festival_id  uuid not null references public.festivals(id) on delete cascade,
  category     text not null check (category in (
                  'wrong_info', 'wrong_location', 'broken_link',
                  'event_cancelled', 'other'
               )),
  message      text not null check (char_length(message) between 1 and 1000),
  reporter_ip  text,
  created_at   timestamptz not null default now(),
  reviewed     boolean not null default false,
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id)
);

create index if not exists festival_reports_festival_id_idx
  on public.festival_reports(festival_id);

create index if not exists festival_reports_created_at_idx
  on public.festival_reports(created_at desc);

create index if not exists festival_reports_reviewed_idx
  on public.festival_reports(reviewed)
  where reviewed = false;

-- RLS: само service role достъпва таблицата
alter table public.festival_reports enable row level security;

-- No policies — service role bypasses RLS
```

- [ ] **Step 2: Приложи migration в Supabase**

Влез в Supabase Dashboard → SQL Editor → изпълни файла.  
Или: `npx supabase db push` ако е конфигурирано локално.

Провери: `select count(*) from festival_reports;` → трябва да върне `0`.

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/festival-report
git add scripts/sql/20260524_festival_reports.sql
git commit -m "chore(db): add festival_reports table with RLS"
```

---

## Task 2: Email тип + schema + template

**Files:**
- Modify: `lib/email/emailJobTypes.ts`
- Modify: `lib/email/emailSchemas.ts`
- Create: `emails/templates/AdminFestivalReportEmail.tsx`
- Modify: `lib/email/emailRegistry.ts`

- [ ] **Step 1: Добави константата в `emailJobTypes.ts`**

В края на константите (преди `EMAIL_JOB_TYPES` масива) добави:

```typescript
export const EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT = "admin-festival-report" as const;
```

В `EMAIL_JOB_TYPES` масива добави новия тип:

```typescript
export const EMAIL_JOB_TYPES = [
  // ... съществуващите ...
  EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT,
] as const;
```

- [ ] **Step 2: Добави payload тип и parser в `emailSchemas.ts`**

В края на файла добави:

```typescript
export type AdminFestivalReportPayload = {
  festivalName: string;
  festivalUrl: string;
  categoryLabel: string;
  message: string;
  reportedAt: string;
};

export function parseAdminFestivalReportPayload(
  raw: Record<string, unknown>,
): AdminFestivalReportPayload {
  return {
    festivalName: reqString(raw, "festivalName", 400),
    festivalUrl: reqString(raw, "festivalUrl", 2000),
    categoryLabel: reqString(raw, "categoryLabel", 200),
    message: reqString(raw, "message", 1000),
    reportedAt: reqString(raw, "reportedAt", 50),
  };
}
```

- [ ] **Step 3: Създай email template**

```tsx
// emails/templates/AdminFestivalReportEmail.tsx
import { Heading, Link, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BaseLayout } from "@/emails/components/BaseLayout";

type Props = {
  siteUrl: string;
  festivalName: string;
  festivalUrl: string;
  categoryLabel: string;
  message: string;
  reportedAt: string;
};

export function AdminFestivalReportEmail({
  siteUrl,
  festivalName,
  festivalUrl,
  categoryLabel,
  message,
  reportedAt,
}: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={heading}>
        Нов сигнал за проблем с фестивал
      </Heading>
      <Text style={label}>
        <strong>Фестивал:</strong>{" "}
        <Link href={festivalUrl} style={link}>
          {festivalName}
        </Link>
      </Text>
      <Text style={label}>
        <strong>Категория:</strong> {categoryLabel}
      </Text>
      <Text style={label}>
        <strong>Дата:</strong> {reportedAt}
      </Text>
      <Text style={label}>
        <strong>Съобщение:</strong>
      </Text>
      <Text style={messageText}>{message}</Text>
    </BaseLayout>
  );
}

const heading: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  color: "#18181b",
};

const label: CSSProperties = {
  margin: "0 0 8px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};

const link: CSSProperties = {
  color: "#ff4c1f",
  textDecoration: "underline",
};

const messageText: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#18181b",
  whiteSpace: "pre-wrap",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};
```

- [ ] **Step 4: Регистрирай в `emailRegistry.ts`**

В импортите добави:
```typescript
import { AdminFestivalReportEmail } from "@/emails/templates/AdminFestivalReportEmail";
import { EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT } from "./emailJobTypes";
import { parseAdminFestivalReportPayload } from "./emailSchemas";
```

В `REGISTRY` обекта (или еквивалентния switch/map) добави entry за новия тип. Намери секцията с `EMAIL_JOB_TYPE_CONTACT_FORM` и добави след нея:

```typescript
[EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT]: {
  buildDefaultSubject: (payload) => {
    const p = parseAdminFestivalReportPayload(payload as Record<string, unknown>);
    return `⚑ Сигнал за проблем: ${p.festivalName}`;
  },
  build: async (payload) => {
    const p = parseAdminFestivalReportPayload(payload as Record<string, unknown>);
    const origin = siteOrigin();
    const { subject, html, text } = await renderEmail(
      createElement(AdminFestivalReportEmail, {
        siteUrl: origin,
        festivalName: p.festivalName,
        festivalUrl: p.festivalUrl,
        categoryLabel: p.categoryLabel,
        message: p.message,
        reportedAt: p.reportedAt,
      }),
      `⚑ Сигнал за проблем: ${p.festivalName}`,
    );
    return { subject, html, text };
  },
},
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Очаквано: без грешки.

- [ ] **Step 6: Commit**

```bash
git add lib/email/emailJobTypes.ts lib/email/emailSchemas.ts \
        emails/templates/AdminFestivalReportEmail.tsx lib/email/emailRegistry.ts
git commit -m "feat(email): add admin-festival-report email type and template"
```

---

## Task 3: Публичен API route

**Files:**
- Create: `app/api/festivals/[id]/report/route.ts`

- [ ] **Step 1: Създай route файла**

```typescript
// app/api/festivals/[id]/report/route.ts
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { shouldEnforceTurnstile, verifyTurnstileToken, getRequestClientIp } from "@/lib/turnstile";
import { enqueueAdminEmailJobSafe } from "@/lib/email/enqueueSafe";
import { EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT } from "@/lib/email/emailJobTypes";
import { getBaseUrl } from "@/lib/config/baseUrl";

const VALID_CATEGORIES = [
  "wrong_info",
  "wrong_location",
  "broken_link",
  "event_cancelled",
  "other",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  wrong_info: "Грешна дата, място или цена",
  wrong_location: "Грешно местоположение на картата",
  broken_link: "Счупен линк или снимка",
  event_cancelled: "Фестивалът е отменен",
  other: "Друго",
};

function isValidCategory(v: unknown): v is Category {
  return typeof v === "string" && (VALID_CATEGORIES as readonly string[]).includes(v);
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`festivo-report:${ip}`).digest("hex").slice(0, 32);
}

// Simple in-process rate limit: 3 reports per IP per 10 min
// Falls back to fail-open — Upstash Redis handles production rate limiting via middleware.
const ipWindowMap = new Map<string, { count: number; resetAt: number }>();
const REPORT_LIMIT = 3;
const REPORT_WINDOW_MS = 10 * 60 * 1000;

function checkLocalRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindowMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipWindowMap.set(ip, { count: 1, resetAt: now + REPORT_WINDOW_MS });
    return true; // allowed
  }
  if (entry.count >= REPORT_LIMIT) return false; // blocked
  entry.count += 1;
  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;

  // Basic UUID check
  if (!/^[0-9a-f-]{36}$/i.test(festivalId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Turnstile
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (shouldEnforceTurnstile()) {
    const clientIp = getRequestClientIp(request);
    const ok = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!ok) {
      return NextResponse.json(
        { error: "Проверката срещу ботове не мина. Опитай отново." },
        { status: 422 },
      );
    }
  }

  // Rate limit (in-process fallback; middleware also rate-limits /api/*)
  const clientIp = getRequestClientIp(request) ?? "unknown";
  if (!checkLocalRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Твърде много сигнали. Опитай след малко." },
      { status: 429 },
    );
  }

  // Validate category
  const category = body.category;
  if (!isValidCategory(category)) {
    return NextResponse.json({ error: "Невалидна категория." }, { status: 400 });
  }

  // Validate message
  const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (rawMessage.length < 1) {
    return NextResponse.json({ error: "Моля, опиши проблема." }, { status: 400 });
  }
  if (rawMessage.length > 1000) {
    return NextResponse.json({ error: "Съобщението е твърде дълго (макс. 1000 символа)." }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  // Verify festival exists
  const { data: festival, error: festivalErr } = await admin
    .from("festivals")
    .select("id, name, slug")
    .eq("id", festivalId)
    .maybeSingle();

  if (festivalErr || !festival) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Insert report
  const { error: insertErr } = await admin.from("festival_reports").insert({
    festival_id: festivalId,
    category,
    message: rawMessage,
    reporter_ip: hashIp(clientIp),
  });

  if (insertErr) {
    console.error("[festival_report] insert failed", insertErr.message);
    return NextResponse.json({ error: "Неуспешен запис. Опитай отново." }, { status: 500 });
  }

  // Enqueue admin email (non-fatal)
  const siteUrl = getBaseUrl().replace(/\/$/, "");
  const festivalUrl = festival.slug
    ? `${siteUrl}/festival/${festival.slug}`
    : `${siteUrl}/festival/${festival.id}`;

  await enqueueAdminEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT,
      recipientUserId: null,
      payload: {
        festivalName: festival.name,
        festivalUrl,
        categoryLabel: CATEGORY_LABELS[category],
        message: rawMessage,
        reportedAt: new Date().toISOString(),
      },
    },
    "festival-report",
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Очаквано: без грешки.

- [ ] **Step 3: Commit**

```bash
git add app/api/festivals/\[id\]/report/route.ts
git commit -m "feat(api): add POST /api/festivals/[id]/report endpoint"
```

---

## Task 4: Admin API routes

**Files:**
- Create: `app/admin/api/festival-reports/route.ts`
- Create: `app/admin/api/festival-reports/[id]/route.ts`

- [ ] **Step 1: Създай GET route (list)**

```typescript
// app/admin/api/festival-reports/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

function parsePositiveInt(raw: string | null, fallback: number, max?: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) return fallback;
  return max != null && n > max ? max : n;
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const perPage = parsePositiveInt(url.searchParams.get("perPage"), DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const reviewedParam = url.searchParams.get("reviewed");

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let query = admin
    .from("festival_reports")
    .select(
      "id, festival_id, category, message, reporter_ip, created_at, reviewed, reviewed_at, festival:festivals(id, name, slug)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (reviewedParam === "0") {
    query = query.eq("reviewed", false);
  } else if (reviewedParam === "1") {
    query = query.eq("reviewed", true);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[admin/festival-reports] query failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, perPage });
}
```

- [ ] **Step 2: Създай PATCH route (mark reviewed)**

```typescript
// app/admin/api/festival-reports/[id]/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { reviewed?: unknown };
  try {
    body = (await request.json()) as { reviewed?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.reviewed !== "boolean") {
    return NextResponse.json({ error: "reviewed must be boolean" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("festival_reports")
    .update({
      reviewed: body.reviewed,
      reviewed_at: body.reviewed ? new Date().toISOString() : null,
      reviewed_by: body.reviewed ? ctx.user.id : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival_report_reviewed",
      entity_type: "festival_report",
      entity_id: id,
      route: `/admin/api/festival-reports/${id}`,
      method: "PATCH",
      details: { reviewed: body.reviewed },
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/api/festival-reports/route.ts \
        "app/admin/api/festival-reports/[id]/route.ts"
git commit -m "feat(admin): add festival-reports GET and PATCH admin API routes"
```

---

## Task 5: Admin UI страница

**Files:**
- Create: `app/admin/(protected)/festival-reports/page.tsx`

- [ ] **Step 1: Създай страницата**

```tsx
// app/admin/(protected)/festival-reports/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { headers } from "next/headers";

const CATEGORY_LABELS: Record<string, string> = {
  wrong_info: "Грешна дата/място/цена",
  wrong_location: "Грешно местоположение",
  broken_link: "Счупен линк/снимка",
  event_cancelled: "Фестивалът е отменен",
  other: "Друго",
};

const PER_PAGE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export default async function AdminFestivalReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/festival-reports");
  }

  const params = await searchParams;
  const reviewed = asString(params.reviewed); // "" | "0" | "1"
  const pageRaw = parseInt(asString(params.page) || "1", 10);
  const page = isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const qs = new URLSearchParams();
  if (reviewed === "0" || reviewed === "1") qs.set("reviewed", reviewed);
  if (page > 1) qs.set("page", String(page));
  qs.set("perPage", String(PER_PAGE));

  const res = await fetch(`${baseUrl}/admin/api/festival-reports?${qs.toString()}`, {
    cache: "no-store",
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
  });

  const payload = (await res.json().catch(() => ({}))) as {
    rows?: Array<{
      id: string;
      category: string;
      message: string;
      reporter_ip: string | null;
      created_at: string;
      reviewed: boolean;
      festival: { id: string; name: string; slug: string | null } | null;
    }>;
    total?: number;
    page?: number;
    perPage?: number;
    error?: string;
  };

  const rows = payload.rows ?? [];
  const total = payload.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function buildHref(p: { reviewed?: string; page?: number }) {
    const sp = new URLSearchParams();
    const r = p.reviewed ?? reviewed;
    if (r === "0" || r === "1") sp.set("reviewed", r);
    if ((p.page ?? page) > 1) sp.set("page", String(p.page ?? page));
    const q = sp.toString();
    return `/admin/festival-reports${q ? `?${q}` : ""}`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <h1 className="text-2xl font-black tracking-tight">Сигнали за проблеми</h1>
        <p className="mt-1 text-sm text-black/65">
          Сигнали от потребители за грешна информация или проблеми с фестивали.
          {total > 0 && <span className="ml-2 text-black/40">({total} общо)</span>}
        </p>

        <div className="mt-4 flex gap-2">
          {[
            { label: "Всички", value: "" },
            { label: "Чакащи", value: "0" },
            { label: "Разгледани", value: "1" },
          ].map(({ label, value }) => (
            <Link
              key={value}
              href={buildHref({ reviewed: value, page: 1 })}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                reviewed === value
                  ? "bg-[#0c0e14] text-white"
                  : "border border-black/[0.12] bg-white hover:bg-black/[0.04]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90">
        {payload.error ? (
          <p className="p-6 text-sm text-[#b13a1a]">{payload.error}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
              <tr>
                <th className="px-4 py-3">Фестивал</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Съобщение</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-black/[0.06]">
                  <td className="px-4 py-3 font-semibold">
                    {row.festival ? (
                      <Link
                        href={
                          row.festival.slug
                            ? `/festival/${row.festival.slug}`
                            : `/admin/festivals/${row.festival.id}`
                        }
                        className="hover:underline"
                        target="_blank"
                      >
                        {row.festival.name}
                      </Link>
                    ) : (
                      <span className="text-black/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-black/70">
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-black/70">
                    <span className="line-clamp-2">{row.message}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-black/70">
                    {new Date(row.created_at).toLocaleDateString("bg-BG")}
                  </td>
                  <td className="px-4 py-3">
                    {row.reviewed ? (
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80">
                        Разгледан
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-200/80">
                        Чакащ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!row.reviewed && (
                      <form
                        action={`/admin/api/festival-reports/${row.id}`}
                        method="post"
                        onSubmit={undefined}
                      >
                        <MarkReviewedButton reportId={row.id} />
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-black/50">
                    Няма сигнали.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3 text-xs text-black/55">
            <span>Страница {page} от {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={buildHref({ page: page - 1 })} className="rounded-md border border-black/[0.12] px-3 py-1 font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]">
                  ← Предишна
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link href={buildHref({ page: page + 1 })} className="rounded-md border border-black/[0.12] px-3 py-1 font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]">
                  Следваща →
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline client component за PATCH
function MarkReviewedButton({ reportId }: { reportId: string }) {
  "use client";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useState } = require("react") as typeof import("react");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-xs text-emerald-700">✓ Разгледан</span>;
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/admin/api/festival-reports/${reportId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewed: true }),
          });
          setDone(true);
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md border border-black/[0.12] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-50"
    >
      {busy ? "..." : "Маркирай разгледан"}
    </button>
  );
}
```

**Забележка:** `MarkReviewedButton` използва `"use client"` inline директива. Ако TypeScript гърми — раздели го в отделен файл `components/admin/MarkReviewedButton.tsx` и го импортирай.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/festival-reports/page.tsx"
git commit -m "feat(admin): add /admin/festival-reports page"
```

---

## Task 6: ReportFestivalModal компонент

**Files:**
- Create: `components/festival/ReportFestivalModal.tsx`

- [ ] **Step 1: Създай компонента**

```tsx
// components/festival/ReportFestivalModal.tsx
"use client";

import { useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";

const CATEGORIES = [
  { value: "wrong_info", label: "Грешна дата, място или цена" },
  { value: "wrong_location", label: "Грешно местоположение на картата" },
  { value: "broken_link", label: "Счупен линк или снимка" },
  { value: "event_cancelled", label: "Фестивалът е отменен" },
  { value: "other", label: "Друго" },
] as const;

type State = "idle" | "submitting" | "success" | "error";

type Props = {
  festivalId: string;
  onClose: () => void;
};

export default function ReportFestivalModal({ festivalId, onClose }: Props) {
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const charCount = message.length;
  const MAX = 1000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;

    const trimmed = message.trim();
    if (!trimmed) {
      setErrorMsg("Моля, опиши проблема.");
      return;
    }

    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/festivals/${festivalId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: trimmed, turnstileToken: turnstileToken ?? "" }),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setState("error");
        setErrorMsg(data.error ?? "Неуспешно изпращане. Опитай отново.");
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        return;
      }

      setState("success");
      setTimeout(() => onClose(), 2500);
    } catch {
      setState("error");
      setErrorMsg("Мрежова грешка. Провери връзката и опитай отново.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4">
          <h2 className="text-base font-bold tracking-tight text-[#0c0e14]">
            Сигнализирай за проблем
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-black/40 hover:bg-black/[0.05] hover:text-black/70"
            aria-label="Затвори"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          {state === "success" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-semibold text-[#0c0e14]">Благодарим!</p>
              <p className="text-sm text-black/60">Ще разгледаме сигнала.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
                  Категория
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-sm text-[#0c0e14] focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/30"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
                  Опиши проблема
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                  placeholder="Напр. Датата е грешна — фестивалът е на 15 юни, не 16..."
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-sm text-[#0c0e14] placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/30"
                />
                <p className={`mt-1 text-right text-[11px] ${charCount > MAX * 0.9 ? "text-amber-600" : "text-black/35"}`}>
                  {charCount} / {MAX}
                </p>
              </div>

              <TurnstileWidget
                ref={turnstileRef}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                className="mt-1"
              />

              {errorMsg && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="flex-1 rounded-lg bg-[#0c0e14] py-2.5 text-sm font-semibold text-white hover:bg-black/80 disabled:opacity-50"
                >
                  {state === "submitting" ? "Изпращане..." : "Изпрати"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-black/[0.12] py-2.5 text-sm font-semibold text-black/70 hover:bg-black/[0.04]"
                >
                  Откажи
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/festival/ReportFestivalModal.tsx
git commit -m "feat(ui): add ReportFestivalModal component"
```

---

## Task 7: Бутон в FestivalRailActionBar

**Files:**
- Modify: `components/festival/FestivalDetailActions.tsx`

- [ ] **Step 1: Добави state и modal в `FestivalRailActionBar`**

В `FestivalRailActionBar` компонента добави:

```tsx
// Добави импорт в горната секция на файла (след съществуващите)
import { lazy, Suspense } from "react";

const ReportFestivalModal = lazy(() => import("@/components/festival/ReportFestivalModal"));
```

В `FestivalRailActionBar` функцията добави state за modal-а (след `const [planBusy, setPlanBusy] = useState(false);`):

```tsx
const [reportOpen, setReportOpen] = useState(false);
```

В JSX return-а на `FestivalRailActionBar`, след последния елемент (след `mapHref` блока) добави:

```tsx
<div className="pt-1 text-center">
  <button
    type="button"
    onClick={() => setReportOpen(true)}
    className="text-xs text-black/35 hover:text-black/60 hover:underline"
  >
    ⚑ Сигнализирай за проблем
  </button>
</div>

{reportOpen && (
  <Suspense fallback={null}>
    <ReportFestivalModal
      festivalId={festivalId}
      onClose={() => setReportOpen(false)}
    />
  </Suspense>
)}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Очаквано: без грешки.

- [ ] **Step 3: Тествай локално**

```bash
npm run dev
```

Отвори `/festival/<slug>` → виж дали бутонът се появява в rail-а → кликни → провери дали modal-ът се отваря → опитай да изпратиш сигнал → провери в Supabase: `select * from festival_reports order by created_at desc limit 5;`

- [ ] **Step 4: Commit**

```bash
git add components/festival/FestivalDetailActions.tsx
git commit -m "feat(ui): add report problem button to festival rail action bar"
```

---

## Task 8: Добавяне на линк в admin навигацията

**Files:**
- Modify: `app/admin/(protected)/layout.tsx` (или еквивалентния nav файл)

- [ ] **Step 1: Намери admin навигацията**

```bash
grep -r "festival-reports\|pending-festivals\|organizer-claims" app/admin --include="*.tsx" -l
```

Намери файла с admin sidebar/nav и добави линк към `/admin/festival-reports` до другите admin секции.

- [ ] **Step 2: Commit и финален PR**

```bash
git add -A
git commit -m "feat(admin): add festival-reports nav link"
git push -u origin feat/festival-report
gh pr create --title "feat: add festival report feature" --body "Добавя възможност за сигнализиране на проблеми с фестивали — modal с категория + текст + Turnstile, записва в festival_reports, изпраща имейл до admin."
gh pr merge --merge
```

---

## Self-Review

**Spec coverage:**
- ✅ `festival_reports` таблица с RLS — Task 1
- ✅ Публичен POST endpoint с Turnstile + rate limit — Task 3
- ✅ Admin GET + PATCH routes — Task 4
- ✅ Admin UI с филтри и пагинация — Task 5
- ✅ Email тип + template + registry — Task 2
- ✅ `ReportFestivalModal` с категория + textarea + Turnstile — Task 6
- ✅ Бутон в rail-а — Task 7
- ✅ Admin nav линк — Task 8

**Типове:** `Category` enum се ползва консистентно в route.ts и modal-а. `CATEGORY_LABELS` е дефиниран и в двете места (route за имейл, page за display).

**Потенциален проблем:** `MarkReviewedButton` с inline `"use client"` може да не работи в Next.js 14. Ако е нужно, раздели в `components/admin/MarkReviewedButton.tsx`.
