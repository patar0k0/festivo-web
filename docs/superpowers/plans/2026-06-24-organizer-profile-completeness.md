# Organizer Profile Completeness Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the organizer portal edit page's live preview panel with a "Пълнота на профила" completeness indicator, and surface the same signal per organization on the organizer dashboard.

**Architecture:** A single pure helper (`computeOrganizerCompleteness`) defines the 5-item completeness rule once. The edit form (client component) recomputes it live from form state via `useMemo`; the dashboard (server component) computes it per organization from a fresh DB read. Both render a thin progress bar + missing-item text using the same shared types.

**Tech Stack:** Next.js 14 App Router, React (client component for the edit form), Supabase JS client, Vitest for the pure-function unit tests.

**Spec:** `docs/superpowers/specs/2026-06-24-organizer-profile-completeness-design.md`

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch off `origin/main`**

```bash
git fetch origin main
git checkout -b feat/organizer-profile-completeness origin/main
```

Expected: branch created, tracking `origin/main`, clean working tree.

---

## Task 1: Shared completeness helper

**Files:**
- Create: `lib/organizer/profileCompleteness.ts`
- Test: `lib/organizer/profileCompleteness.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/organizer/profileCompleteness.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeOrganizerCompleteness } from "./profileCompleteness";

function baseInput() {
  return {
    logo_url: "",
    description: "",
    website_url: "",
    facebook_url: "",
    instagram_url: "",
    email: "",
    phone: "",
    festivalCount: 0,
  };
}

describe("computeOrganizerCompleteness", () => {
  it("returns 0/5 done when everything is empty", () => {
    const result = computeOrganizerCompleteness(baseInput());
    expect(result.doneCount).toBe(0);
    expect(result.total).toBe(5);
    expect(result.items.every((item) => !item.done)).toBe(true);
  });

  it("returns 5/5 done when every field is filled", () => {
    const result = computeOrganizerCompleteness({
      logo_url: "https://example.com/logo.png",
      description: "Народно читалище",
      website_url: "https://example.bg",
      facebook_url: "",
      instagram_url: "",
      email: "org@example.bg",
      phone: "",
      festivalCount: 1,
    });
    expect(result.doneCount).toBe(5);
  });

  it("counts the links item as done when only facebook_url is set", () => {
    const result = computeOrganizerCompleteness({ ...baseInput(), facebook_url: "https://facebook.com/x" });
    const linksItem = result.items.find((item) => item.key === "links");
    expect(linksItem?.done).toBe(true);
  });

  it("counts the contact item as done when only phone is set", () => {
    const result = computeOrganizerCompleteness({ ...baseInput(), phone: "0888123456" });
    const contactItem = result.items.find((item) => item.key === "contact");
    expect(contactItem?.done).toBe(true);
  });

  it("treats whitespace-only strings as empty", () => {
    const result = computeOrganizerCompleteness({ ...baseInput(), description: "   " });
    const descItem = result.items.find((item) => item.key === "description");
    expect(descItem?.done).toBe(false);
  });

  it("marks the festival item done only when festivalCount is greater than 0", () => {
    const zero = computeOrganizerCompleteness({ ...baseInput(), festivalCount: 0 });
    const one = computeOrganizerCompleteness({ ...baseInput(), festivalCount: 1 });
    expect(zero.items.find((i) => i.key === "festival")?.done).toBe(false);
    expect(one.items.find((i) => i.key === "festival")?.done).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/organizer/profileCompleteness.test.ts`

Expected: FAIL — `Cannot find module './profileCompleteness'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/organizer/profileCompleteness.ts`:

```ts
export type OrganizerCompletenessInput = {
  logo_url: string;
  description: string;
  website_url: string;
  facebook_url: string;
  instagram_url: string;
  email: string;
  phone: string;
  festivalCount: number;
};

export type OrganizerCompletenessItemKey = "logo" | "description" | "links" | "contact" | "festival";

export type OrganizerCompletenessItem = {
  key: OrganizerCompletenessItemKey;
  label: string;
  done: boolean;
};

export type OrganizerCompletenessResult = {
  items: OrganizerCompletenessItem[];
  doneCount: number;
  total: number;
};

/**
 * 5 equally-weighted profile completeness signals for the organizer-facing portal.
 * `verified` is intentionally excluded — it's admin-only and not actionable by the organizer.
 */
export function computeOrganizerCompleteness(input: OrganizerCompletenessInput): OrganizerCompletenessResult {
  const items: OrganizerCompletenessItem[] = [
    { key: "logo", label: "Лого", done: Boolean(input.logo_url.trim()) },
    { key: "description", label: "Описание", done: Boolean(input.description.trim()) },
    {
      key: "links",
      label: "Уебсайт или социална мрежа",
      done: Boolean(input.website_url.trim() || input.facebook_url.trim() || input.instagram_url.trim()),
    },
    {
      key: "contact",
      label: "Контакт (имейл или телефон)",
      done: Boolean(input.email.trim() || input.phone.trim()),
    },
    { key: "festival", label: "Поне 1 фестивал в каталога", done: input.festivalCount > 0 },
  ];

  const doneCount = items.filter((item) => item.done).length;

  return { items, doneCount, total: items.length };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/organizer/profileCompleteness.test.ts`

Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/organizer/profileCompleteness.ts lib/organizer/profileCompleteness.test.ts
git commit -m "feat(organizer): add shared profile completeness calculation"
```

---

## Task 2: Strip the live preview out of the edit form

**Files:**
- Modify: `components/organizer/OrganizerProfileEditForm.tsx`

This task removes the right-column live preview and everything that exists only to feed it, and collapses the layout to a single column. The component keeps working exactly as before for the form fields, autosave, and validation — only the preview goes away.

- [ ] **Step 1: Remove the now-unused imports**

In `components/organizer/OrganizerProfileEditForm.tsx`, find:

```ts
import Image from "next/image";
import Link from "next/link";
import OrganizerProfileLogo from "@/components/organizers/OrganizerProfileLogo";
import { useDebouncedSave } from "@/lib/hooks/useDebouncedSave";
import { useDirtyState } from "@/lib/hooks/useDirtyState";
import { normalizeExternalHttpHref } from "@/lib/urls/externalHref";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
```

Replace with:

```ts
import Image from "next/image";
import Link from "next/link";
import { useDebouncedSave } from "@/lib/hooks/useDebouncedSave";
import { useDirtyState } from "@/lib/hooks/useDirtyState";
import { computeOrganizerCompleteness } from "@/lib/organizer/profileCompleteness";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
```

(`OrganizerProfileLogo` and `normalizeExternalHttpHref` were only used by the preview panel being removed; `Image` and `Link` stay — `Image` renders the logo-upload thumbnail in the form itself, `Link` renders the "Към таблото" link.)

- [ ] **Step 2: Remove the preview-only helper functions**

Find and delete these two function declarations entirely (they're only called from the preview panel removed in Step 6):

```ts
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 16h-8.5A2.25 2.25 0 0 1 2 13.75v-8.5A2.25 2.25 0 0 1 4.25 3h4a.75.75 0 0 1 0 1.5h-4Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M6.194 13.915a.75.75 0 0 0 1.06.053l7.25-6.5a.75.75 0 0 0-1-1.12l-7.25 6.5a.75.75 0 0 0-.053 1.06ZM16.78 3.22a.75.75 0 1 0-1.06 1.06L9.47 10.53l1.06 1.06 6.25-6.25a.75.75 0 0 0 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
```

Also delete the `organizerInitialsFromName` function (only used to compute the preview's avatar initials):

```ts
function organizerInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  const single = parts[0] ?? name;
  return single.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 3: Drop `verified` from the props type and add `festivalCount`**

Find:

```ts
type OrganizerProfileEditFormProps = {
  organizerId: string;
  /** Public profile path segment: `/organizers/{slug}` */
  publicProfileSlug: string;
  cities: OrganizerCityOption[];
  initial: {
    name: string;
    description: string;
    logo_url: string;
    website_url: string;
    facebook_url: string;
    instagram_url: string;
    email: string;
    phone: string;
    verified: boolean;
    city_id: number | null;
  };
};
```

Replace with:

```ts
type OrganizerProfileEditFormProps = {
  organizerId: string;
  /** Public profile path segment: `/organizers/{slug}` */
  publicProfileSlug: string;
  cities: OrganizerCityOption[];
  /** Published festival count for this organizer — feeds the completeness indicator. */
  festivalCount: number;
  initial: {
    name: string;
    description: string;
    logo_url: string;
    website_url: string;
    facebook_url: string;
    instagram_url: string;
    email: string;
    phone: string;
    city_id: number | null;
  };
};
```

- [ ] **Step 4: Update the function signature and remove preview-only state/derived values**

Find:

```ts
export default function OrganizerProfileEditForm({
  organizerId,
  publicProfileSlug,
  cities,
  initial,
}: OrganizerProfileEditFormProps) {
  const [form, setForm] = useState({
    name: initial.name,
    description: initial.description,
    logo_url: initial.logo_url || "",
    website_url: initial.website_url,
    facebook_url: initial.facebook_url,
    instagram_url: initial.instagram_url,
    email: initial.email,
    phone: initial.phone,
    city_id: initial.city_id,
  });
  const { setLastSaved, checkDirty } = useDirtyState(initialPatchSnapshot(initial));
  const [verifiedPreview, setVerifiedPreview] = useState(initial.verified);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
```

Replace with:

```ts
export default function OrganizerProfileEditForm({
  organizerId,
  publicProfileSlug,
  cities,
  festivalCount,
  initial,
}: OrganizerProfileEditFormProps) {
  const [form, setForm] = useState({
    name: initial.name,
    description: initial.description,
    logo_url: initial.logo_url || "",
    website_url: initial.website_url,
    facebook_url: initial.facebook_url,
    instagram_url: initial.instagram_url,
    email: initial.email,
    phone: initial.phone,
    city_id: initial.city_id,
  });
  const { setLastSaved, checkDirty } = useDirtyState(initialPatchSnapshot(initial));
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
```

- [ ] **Step 5: Remove the other preview-only derived values, add the completeness `useMemo`, and drop the `body.verified` handling**

Find:

```ts
  const snapshot = useMemo(() => normalizeFormData(form), [form]);
  const dirty = checkDirty(snapshot);
  const fieldErrors = useMemo(() => getFieldErrors(snapshot), [snapshot]);
  const isValid = Object.keys(fieldErrors).length === 0;

  const previewLogoUrl = (localLogoObjectUrl ?? form.logo_url.trim()) || null;
  const previewInitials = organizerInitialsFromName(form.name);
  const previewWebsiteHref = normalizeExternalHttpHref(form.website_url);
  const previewFacebookHref = normalizeExternalHttpHref(form.facebook_url);
  const previewInstagramHref = normalizeExternalHttpHref(form.instagram_url);
  const hasSocialOrWeb = Boolean(previewWebsiteHref || previewFacebookHref || previewInstagramHref);
  const previewEmail = form.email.trim() || null;
  const previewPhone = form.phone.trim() || null;
  const previewCityName = cities.find((c) => c.id === form.city_id)?.name_bg ?? null;
  const previewCityLabel =
    previewCityName ?? (form.city_id == null ? "Без избран град" : "Град не е наличен");
  const previewCityIsFallback = previewCityName === null;
```

Replace with:

```ts
  const snapshot = useMemo(() => normalizeFormData(form), [form]);
  const dirty = checkDirty(snapshot);
  const fieldErrors = useMemo(() => getFieldErrors(snapshot), [snapshot]);
  const isValid = Object.keys(fieldErrors).length === 0;

  const previewLogoUrl = (localLogoObjectUrl ?? form.logo_url.trim()) || null;

  const completeness = useMemo(
    () =>
      computeOrganizerCompleteness({
        logo_url: snapshot.logo_url,
        description: snapshot.description,
        website_url: snapshot.website_url,
        facebook_url: snapshot.facebook_url,
        instagram_url: snapshot.instagram_url,
        email: snapshot.email,
        phone: snapshot.phone,
        festivalCount,
      }),
    [snapshot, festivalCount],
  );
```

Then find, inside `executePatch`:

```ts
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        verified?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setSaveStatus("error");
        setApiError(typeof body.error === "string" ? body.error : SUBMIT_ERROR_FALLBACK);
        return false;
      }

      if (typeof body.verified === "boolean") {
        setVerifiedPreview(body.verified);
      }

      setLastSaved(snap);
```

Replace with:

```ts
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setSaveStatus("error");
        setApiError(typeof body.error === "string" ? body.error : SUBMIT_ERROR_FALLBACK);
        return false;
      }

      setLastSaved(snap);
```

- [ ] **Step 6: Collapse the two-column layout and remove the preview panel**

Find the closing of the form and the entire preview block (everything from the outer wrapper `<div ref={rootRef} ...>` through the matching closing `</div>` after the preview, i.e. the full return statement):

```tsx
  return (
    <div
      ref={rootRef}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(280px,380px)] lg:items-start"
      onClickCapture={handleNavigation}
    >
      <form onSubmit={onSubmit} className="flex flex-col rounded-2xl border border-black/[0.08] bg-white/90 shadow-sm md:pb-0">
        <div className="space-y-0 px-6 pb-6 pt-6 md:px-8 md:pt-8">
          <div className="flex flex-col gap-6">
            <FormSection
              isPrimary
              title="Основна информация"
              description="Име, описание и лого — това виждат първо в публичния профил."
            >
```

Replace with:

```tsx
  const missingLabels = completeness.items.filter((item) => !item.done).map((item) => item.label);
  const completenessPercent = Math.round((completeness.doneCount / completeness.total) * 100);

  return (
    <div ref={rootRef} className="max-w-2xl" onClickCapture={handleNavigation}>
      <form onSubmit={onSubmit} className="flex flex-col rounded-2xl border border-black/[0.08] bg-white/90 shadow-sm md:pb-0">
        <div className="space-y-0 px-6 pb-6 pt-6 md:px-8 md:pt-8">
          <div className="rounded-xl border border-amber-200/55 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#0c0e14]">Пълнота на профила</p>
              <span className="text-xs font-medium text-black/55">
                {completeness.doneCount}/{completeness.total} попълнени
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
            {missingLabels.length > 0 ? (
              <p className="mt-2 text-xs text-black/55">Липсва: {missingLabels.join(", ")}</p>
            ) : (
              <p className="mt-2 text-xs font-medium text-emerald-700">Профилът е напълно попълнен 🎉</p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-6">
            <FormSection
              isPrimary
              title="Основна информация"
              description="Име, описание и лого — това виждат първо в публичния профил."
            >
```

Note the `<div className="flex flex-col gap-6">` became `<div className="mt-6 flex flex-col gap-6">` (adding top margin below the new completeness card) — every `FormSection` that was inside it stays exactly where it was, untouched.

- [ ] **Step 7: Remove the closing tags of the deleted right column and outer grid**

Find (this is the end of the form's sticky footer, followed by the entire preview column and the outer grid's closing tag):

```tsx
          <p className="mt-3 text-center text-xs text-black/45">
            <Link
              href="/organizer/dashboard"
              className="text-black underline decoration-black/35 underline-offset-2 hover:decoration-black"
            >
              Към таблото
            </Link>
          </p>
        </div>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-black/50">Преглед (в реално време)</p>
        <div
          className={cn(
            pub.heroMainCard,
            "relative overflow-hidden transition-shadow duration-150 hover:shadow-md lg:sticky lg:top-6",
          )}
        >
```

Everything from `<div className="space-y-2">` down to the matching closing `</div></div>` right before the component's final `</div>\n  );\n}` must be deleted. Replace the snippet above with:

```tsx
          <p className="mt-3 text-center text-xs text-black/45">
            <Link
              href="/organizer/dashboard"
              className="text-black underline decoration-black/35 underline-offset-2 hover:decoration-black"
            >
              Към таблото
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
```

(This removes the entire preview JSX block — the amber gradient header, the `OrganizerProfileLogo`, the verified badge, the city pill, the social/web links, the contact card, and the description block — all the way through the original final `</div>\n    </div>\n  );\n}`. Nothing after the form's sticky footer survives except the two closing tags shown above.)

- [ ] **Step 8: Verify the file has no leftover references**

Run:

```bash
grep -n "verifiedPreview\|previewWebsiteHref\|previewFacebookHref\|previewInstagramHref\|previewEmail\|previewPhone\|previewCityName\|previewCityLabel\|previewCityIsFallback\|previewInitials\|hasSocialOrWeb\|OrganizerProfileLogo\|telHref\|ExternalLinkIcon\|organizerInitialsFromName\|normalizeExternalHttpHref\|Преглед (в реално време)" components/organizer/OrganizerProfileEditForm.tsx
```

Expected: no output (zero matches). If anything matches, remove the leftover reference before continuing.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: no errors from `components/organizer/OrganizerProfileEditForm.tsx`. (It will still error if Task 3 hasn't been done yet, since the page that renders this component won't pass `festivalCount` — that's expected and resolved in Task 3.)

- [ ] **Step 10: Commit**

```bash
git add components/organizer/OrganizerProfileEditForm.tsx
git commit -m "feat(organizer): replace live preview with completeness indicator in edit form"
```

---

## Task 3: Wire `festivalCount` into the edit page and drop `verified`

**Files:**
- Modify: `app/organizer/(workspace)/organizations/[id]/edit/page.tsx`

- [ ] **Step 1: Drop `verified` from the organizer select**

Find:

```ts
  const { data: organizer, error: organizerError } = await admin
    .from("organizers")
    .select(
      "id,slug,name,description,logo_url,website_url,facebook_url,instagram_url,email,phone,verified,city_id",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
```

Replace with:

```ts
  const { data: organizer, error: organizerError } = await admin
    .from("organizers")
    .select(
      "id,slug,name,description,logo_url,website_url,facebook_url,instagram_url,email,phone,city_id",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
```

- [ ] **Step 2: Fetch the published festival count alongside the cities list**

Find:

```ts
  const { data: cityRows, error: citiesError } = await admin
    .from("cities")
    .select("id,name_bg")
    .order("name_bg", { ascending: true });

  if (citiesError) {
    console.error("[organizer/organizations/[id]/edit] load cities failed", citiesError.message);
    throw new Error(citiesError.message);
  }
```

Replace with:

```ts
  const [citiesRes, festivalCountRes] = await Promise.all([
    admin.from("cities").select("id,name_bg").order("name_bg", { ascending: true }),
    admin
      .from("festivals")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", id)
      .in("status", ["verified", "published"]),
  ]);

  const { data: cityRows, error: citiesError } = citiesRes;

  if (citiesError) {
    console.error("[organizer/organizations/[id]/edit] load cities failed", citiesError.message);
    throw new Error(citiesError.message);
  }

  if (festivalCountRes.error) {
    console.error("[organizer/organizations/[id]/edit] load festival count failed", festivalCountRes.error.message);
  }

  const festivalCount = festivalCountRes.count ?? 0;
```

- [ ] **Step 3: Pass `festivalCount` to the form and drop `verified` from `initial`**

Find:

```tsx
      <OrganizerProfileEditForm
        organizerId={id}
        publicProfileSlug={publicSlug}
        cities={cityOptions}
        initial={{
          name: organizer.name ?? "",
          description: organizer.description ?? "",
          logo_url: organizer.logo_url ?? "",
          website_url: organizer.website_url ?? "",
          facebook_url: organizer.facebook_url ?? "",
          instagram_url: organizer.instagram_url ?? "",
          email: organizer.email ?? "",
          phone: organizer.phone ?? "",
          verified: Boolean(organizer.verified),
          city_id:
            organizer.city_id != null && Number.isFinite(Number(organizer.city_id))
              ? Number(organizer.city_id)
              : null,
        }}
      />
```

Replace with:

```tsx
      <OrganizerProfileEditForm
        organizerId={id}
        publicProfileSlug={publicSlug}
        cities={cityOptions}
        festivalCount={festivalCount}
        initial={{
          name: organizer.name ?? "",
          description: organizer.description ?? "",
          logo_url: organizer.logo_url ?? "",
          website_url: organizer.website_url ?? "",
          facebook_url: organizer.facebook_url ?? "",
          instagram_url: organizer.instagram_url ?? "",
          email: organizer.email ?? "",
          phone: organizer.phone ?? "",
          city_id:
            organizer.city_id != null && Number.isFinite(Number(organizer.city_id))
              ? Number(organizer.city_id)
              : null,
        }}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/organizer/(workspace)/organizations/[id]/edit/page.tsx"
git commit -m "feat(organizer): feed festival count into the edit page completeness indicator"
```

---

## Task 4: Completeness bar per organization on the dashboard

**Files:**
- Modify: `app/organizer/(workspace)/dashboard/page.tsx`

- [ ] **Step 1: Import the shared helper and expand `OrgRow`**

Find:

```ts
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { bg } from "date-fns/locale";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { getOptionalUser } from "@/lib/authUser";

export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  organizer_id: string | null;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};
```

Replace with:

```ts
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { bg } from "date-fns/locale";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { getOptionalUser } from "@/lib/authUser";
import {
  computeOrganizerCompleteness,
  type OrganizerCompletenessResult,
} from "@/lib/organizer/profileCompleteness";

export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  organizer_id: string | null;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
};

type FestivalOrgIdRow = {
  organizer_id: string | null;
};
```

- [ ] **Step 2: Expand the organizers select and add the festivals-count query**

Find:

```ts
  // Fetch the session user (for the greeting), organizations (with logo) and submissions in parallel.
  const [sessionUser, orgsRes, submissionsRes] = await Promise.all([
    getOptionalUser(),
    orgIds.length > 0
      ? admin
          .from("organizers")
          .select("id,name,slug,logo_url")
          .in("id", orgIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as OrgRow[] }),
    orgIds.length > 0
      ? admin
          .from("pending_festivals")
          .select("id,title,status,created_at,organizer_id,submission_source")
          .in("organizer_id", orgIds)
          .eq("submission_source", "organizer_portal")
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as SubmissionRow[] }),
  ]);

  const orgRows = (orgsRes.data ?? []) as OrgRow[];
  const submissions = (submissionsRes.data ?? []) as SubmissionRow[];
```

Replace with:

```ts
  // Fetch the session user (for the greeting), organizations (with profile fields), submissions,
  // and published-festival counts in parallel.
  const [sessionUser, orgsRes, submissionsRes, festivalsRes] = await Promise.all([
    getOptionalUser(),
    orgIds.length > 0
      ? admin
          .from("organizers")
          .select("id,name,slug,logo_url,description,website_url,facebook_url,instagram_url,email,phone")
          .in("id", orgIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as OrgRow[] }),
    orgIds.length > 0
      ? admin
          .from("pending_festivals")
          .select("id,title,status,created_at,organizer_id,submission_source")
          .in("organizer_id", orgIds)
          .eq("submission_source", "organizer_portal")
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as SubmissionRow[] }),
    orgIds.length > 0
      ? admin
          .from("festivals")
          .select("organizer_id")
          .in("organizer_id", orgIds)
          .in("status", ["verified", "published"])
      : Promise.resolve({ data: [] as FestivalOrgIdRow[] }),
  ]);

  const orgRows = (orgsRes.data ?? []) as OrgRow[];
  const submissions = (submissionsRes.data ?? []) as SubmissionRow[];

  const festivalCountByOrg = new Map<string, number>();
  for (const row of (festivalsRes.data ?? []) as FestivalOrgIdRow[]) {
    if (!row.organizer_id) continue;
    festivalCountByOrg.set(row.organizer_id, (festivalCountByOrg.get(row.organizer_id) ?? 0) + 1);
  }
```

- [ ] **Step 3: Render the completeness bar under each organization row**

Find:

```tsx
        ) : (
          <ul className="mt-5 space-y-3">
            {orgRows.map((org) => (
              <li
                key={org.id}
                className="group rounded-xl border border-black/[0.07] bg-white px-4 py-3.5 transition-all duration-150 hover:border-black/[0.15] hover:shadow-sm md:px-5 md:py-4"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <OrganizerLogo name={org.name} logoUrl={org.logo_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0c0e14] md:text-base">
                      {org.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-black/50">
                      festivo.bg/organizers/{org.slug}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/organizer/organizations/${org.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-black/[0.04]"
                    >
                      Редактирай
                    </Link>
                    <Link
                      href={`/organizers/${org.slug}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-black/55 transition hover:text-[#0c0e14] hover:underline hover:underline-offset-2"
                    >
                      Публичен профил →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
```

Replace with:

```tsx
        ) : (
          <ul className="mt-5 space-y-3">
            {orgRows.map((org) => {
              const completeness = computeOrganizerCompleteness({
                logo_url: org.logo_url ?? "",
                description: org.description ?? "",
                website_url: org.website_url ?? "",
                facebook_url: org.facebook_url ?? "",
                instagram_url: org.instagram_url ?? "",
                email: org.email ?? "",
                phone: org.phone ?? "",
                festivalCount: festivalCountByOrg.get(org.id) ?? 0,
              });
              return (
                <li
                  key={org.id}
                  className="group rounded-xl border border-black/[0.07] bg-white px-4 py-3.5 transition-all duration-150 hover:border-black/[0.15] hover:shadow-sm md:px-5 md:py-4"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <OrganizerLogo name={org.name} logoUrl={org.logo_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0c0e14] md:text-base">
                        {org.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-black/50">
                        festivo.bg/organizers/{org.slug}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/organizer/organizations/${org.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-black/[0.04]"
                      >
                        Редактирай
                      </Link>
                      <Link
                        href={`/organizers/${org.slug}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-black/55 transition hover:text-[#0c0e14] hover:underline hover:underline-offset-2"
                      >
                        Публичен профил →
                      </Link>
                    </div>
                  </div>
                  <CompletenessBar completeness={completeness} />
                </li>
              );
            })}
          </ul>
        )}
```

- [ ] **Step 4: Add the `CompletenessBar` subcomponent**

Find the `OrganizerLogo` subcomponent at the bottom of the file:

```tsx
function OrganizerLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
```

Insert this new subcomponent immediately **before** it:

```tsx
function CompletenessBar({ completeness }: { completeness: OrganizerCompletenessResult }) {
  const missing = completeness.items.filter((item) => !item.done).map((item) => item.label);
  const percent = Math.round((completeness.doneCount / completeness.total) * 100);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-black/50">Пълнота на профила</span>
        <span className="text-[11px] font-medium text-black/50">
          {completeness.doneCount}/{completeness.total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <p className="mt-1.5 text-[11px] text-black/45">Липсва: {missing.join(", ")}</p>
      ) : null}
    </div>
  );
}

function OrganizerLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/organizer/(workspace)/dashboard/page.tsx"
git commit -m "feat(organizer): show profile completeness bar per organization on dashboard"
```

---

## Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npx vitest run`

Expected: all tests pass, including the 6 new `profileCompleteness` tests.

- [ ] **Step 2: Start the dev server and open the edit page**

Use the preview tool to start the dev server, then navigate to an organizer edit page, e.g. `/organizer/organizations/<id>/edit` (use an org id you own — from the earlier session, `bc139bda-9d5a-4cac-9686-187fcd63c71c`).

Verify:
- The right-column "Преглед (в реално време)" panel is gone; the form is single-column.
- A "Пълнота на профила" card with a progress bar appears above "Основна информация".
- Typing into "Описание" (and other fields) updates the bar and the "Липсва: ..." text live, without a page reload.
- Saving still works (autosave status text still appears at the bottom).

- [ ] **Step 3: Open the dashboard**

Navigate to `/organizer/dashboard`.

Verify:
- Each row under "Моите организации" shows a "Пълнота на профила" progress bar with an `X/5` count.
- An organization with a published festival shows the "festival" item satisfied (bar reflects it); one with none shows "Поне 1 фестивал в каталога" in the "Липсва: ..." line.

- [ ] **Step 4: Capture a screenshot of both pages as evidence**

Use the preview tool's screenshot capability on both `/organizer/organizations/<id>/edit` and `/organizer/dashboard` to confirm the visual result before declaring the task done.

---

## Task 6: Push, PR, merge

**Files:** none (git only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/organizer-profile-completeness
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(organizer): profile completeness indicator" --body "$(cat <<'EOF'
## Proposed Change
- Summary: Removes the organizer portal edit page's live preview panel and replaces it with a "Пълнота на профила" completeness indicator (5 signals: logo, description, links, contact, published festival), computed by a new shared pure helper `lib/organizer/profileCompleteness.ts`. The same indicator now also shows per organization on `/organizer/dashboard`.
- Why now: The live preview only mirrored already-typed data; it didn't nudge organizers to actually complete their profile. See design spec for the full rationale.

## Impacted Docs
- docs/superpowers/specs/2026-06-24-organizer-profile-completeness-design.md (already committed)

## Checklist
- [x] Schema: none
- [x] API contract: no change (PATCH route untouched; client just stops reading an already-returned field)
- [x] Background jobs: n/a
- [x] Security: server components only read via the existing organizer-portal-gated Supabase admin client; no new privileged exposure
- [x] SEO: n/a
- [x] Mobile sync: n/a
- [x] Docs updated in this PR: spec already in repo
- [x] CLAUDE.md updated: n/a (no architectural change)
EOF
)"
```

- [ ] **Step 3: Merge**

```bash
gh pr merge --merge --delete-branch
```

---

## Self-Review Notes

- **Spec coverage:** shared helper (Task 1), edit form preview removal + indicator (Task 2), edit page wiring (Task 3), dashboard indicator (Task 4), manual verification (Task 5) — all 4 spec sections covered.
- **Type consistency:** `OrganizerCompletenessInput`/`OrganizerCompletenessItem`/`OrganizerCompletenessResult` defined once in Task 1 and imported verbatim (same names) in Tasks 2 and 4 — no renames across tasks.
- **No placeholders:** every step shows the literal before/after code; no "similar to above" or "add validation" steps.
