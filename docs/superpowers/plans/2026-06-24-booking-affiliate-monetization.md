# Booking Affiliate Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the „Настаняване наблизо" Booking.com link carry affiliate attribution (`aid` + per-festival `label`) so the site earns commission, with a zero-risk fallback to the current plain URL when no affiliate id is configured.

**Architecture:** A pure helper `withBookingAffiliate(rawUrl, festivalId, opts)` appends `aid` and a sanitized `label` to a clean booking.com URL. The `aid` is **public** (it appears in the outbound link the user clicks), so it is read from server env in `app/festivals/[slug]/page.tsx` and passed as props down through `FestivalDetailClient` to `FestivalNearbyBookingCard`, which wraps the URL before handing it to the existing `/out` click-tracking layer. No change to tracking, dedup, or visible UX.

**Tech Stack:** Next.js 14 App Router, TypeScript, vitest (`npm test`), date-fns.

---

## File Structure

- **Create** `lib/outbound/affiliate.ts` — pure `withBookingAffiliate` helper (one responsibility: affiliate URL wrapping).
- **Create** `lib/outbound/affiliate.test.ts` — vitest unit tests for the helper.
- **Modify** `components/festival/FestivalNearbyBookingCard.tsx` — accept `affiliateAid` + `affiliateLabelPrefix` props, wrap the built URL via the helper.
- **Modify** `components/festival/FestivalDetailClient.tsx` — accept the two new props (`Props` type + function signature), thread them to the card.
- **Modify** `app/festivals/[slug]/page.tsx` — read `BOOKING_AFFILIATE_AID` / `BOOKING_AFFILIATE_LABEL_PREFIX` from env, pass to `FestivalDetailClient`.
- **Modify** `README.md` — document the two env vars.
- **Modify** `CLAUDE.md` — add the two env vars to the env table.

---

## Task 1: Pure affiliate helper (TDD)

**Files:**
- Create: `lib/outbound/affiliate.ts`
- Test: `lib/outbound/affiliate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/outbound/affiliate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { withBookingAffiliate } from "@/lib/outbound/affiliate";

const BASE =
  "https://www.booking.com/searchresults.html?ss=Sofia&checkin=2026-07-01&checkout=2026-07-02";

describe("withBookingAffiliate", () => {
  it("returns the url unchanged when no aid is provided", () => {
    expect(withBookingAffiliate(BASE, "abc", { aid: "" })).toBe(BASE);
    expect(withBookingAffiliate(BASE, "abc", { aid: undefined })).toBe(BASE);
  });

  it("appends aid and a festival-scoped label when aid is provided", () => {
    const out = new URL(withBookingAffiliate(BASE, "fest-123", { aid: "9999" }));
    expect(out.searchParams.get("aid")).toBe("9999");
    expect(out.searchParams.get("label")).toBe("festivo-fest-123");
  });

  it("preserves existing query params", () => {
    const out = new URL(withBookingAffiliate(BASE, "fest-123", { aid: "9999" }));
    expect(out.searchParams.get("ss")).toBe("Sofia");
    expect(out.searchParams.get("checkin")).toBe("2026-07-01");
    expect(out.searchParams.get("checkout")).toBe("2026-07-02");
  });

  it("uses a custom label prefix when given", () => {
    const out = new URL(
      withBookingAffiliate(BASE, "fest-123", { aid: "9999", labelPrefix: "fv" }),
    );
    expect(out.searchParams.get("label")).toBe("fv-fest-123");
  });

  it("falls back to a 'site' label segment when festivalId is missing", () => {
    const out = new URL(withBookingAffiliate(BASE, null, { aid: "9999" }));
    expect(out.searchParams.get("label")).toBe("festivo-site");
  });

  it("sanitizes the label to alnum, dash and underscore", () => {
    const out = new URL(
      withBookingAffiliate(BASE, "a b/c?d", { aid: "9999", labelPrefix: "fes tivo" }),
    );
    // spaces and slashes/question marks collapse to dashes
    expect(out.searchParams.get("label")).toBe("fes-tivo-a-b-c-d");
  });

  it("returns the original string unchanged on an unparseable url", () => {
    expect(withBookingAffiliate("not a url", "abc", { aid: "9999" })).toBe("not a url");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/outbound/affiliate.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/outbound/affiliate"` / module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/outbound/affiliate.ts`:

```ts
/**
 * Booking.com affiliate attribution.
 *
 * The `aid` value may come from a direct Booking.com Affiliate Partner Program
 * account OR from a Travelpayouts Booking program — the URL shape is identical
 * either way (append `aid` + `label`). `aid` is NOT a secret: it appears in the
 * public outbound link the user clicks.
 */

export type BookingAffiliateOptions = {
  /** Booking affiliate id. Empty/undefined → URL returned unchanged. */
  aid?: string | null;
  /** Label prefix for per-festival stats. Defaults to "festivo". */
  labelPrefix?: string | null;
};

/** Collapse anything outside [a-z0-9_] to single dashes; trim leading/trailing dashes. */
function sanitizeLabelSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Append Booking affiliate `aid` + a festival-scoped `label` to a clean
 * booking.com URL. Returns the input unchanged when `aid` is empty or the URL
 * cannot be parsed (fail-safe — the link must always still work).
 */
export function withBookingAffiliate(
  rawUrl: string,
  festivalId: string | null | undefined,
  opts: BookingAffiliateOptions,
): string {
  const aid = opts.aid?.trim();
  if (!aid) return rawUrl;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const prefix = sanitizeLabelSegment(opts.labelPrefix?.trim() || "festivo") || "festivo";
  const idSegment = sanitizeLabelSegment(String(festivalId ?? "")) || "site";

  url.searchParams.set("aid", aid);
  url.searchParams.set("label", `${prefix}-${idSegment}`);
  return url.toString();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/outbound/affiliate.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/outbound/affiliate.ts lib/outbound/affiliate.test.ts
git commit -m "feat(outbound): add Booking affiliate URL helper"
```

---

## Task 2: Wire the helper into the booking card

**Files:**
- Modify: `components/festival/FestivalNearbyBookingCard.tsx`

- [ ] **Step 1: Add the import and new props, wrap the URL**

In `components/festival/FestivalNearbyBookingCard.tsx`:

Add the import near the top (after the existing `outboundClickHref` import):

```ts
import { withBookingAffiliate } from "@/lib/outbound/affiliate";
```

Extend the `Props` type to include the affiliate inputs:

```ts
type Props = {
  place: string;
  startDate: string;
  endDate?: string | null;
  festivalId: string;
  affiliateAid?: string | null;
  affiliateLabelPrefix?: string | null;
};
```

Update the component signature and URL construction. Replace:

```ts
export default function FestivalNearbyBookingCard({ place, startDate, endDate, festivalId }: Props) {
  const href = buildBookingSearchUrl(place, startDate, endDate);
  if (!href) return null;

  const trackedHref = outboundClickHref({
    targetUrl: href,
    festivalId,
    type: "booking",
    source: "festival_detail",
  });
```

with:

```ts
export default function FestivalNearbyBookingCard({
  place,
  startDate,
  endDate,
  festivalId,
  affiliateAid,
  affiliateLabelPrefix,
}: Props) {
  const href = buildBookingSearchUrl(place, startDate, endDate);
  if (!href) return null;

  const affiliateHref = withBookingAffiliate(href, festivalId, {
    aid: affiliateAid,
    labelPrefix: affiliateLabelPrefix,
  });

  const trackedHref = outboundClickHref({
    targetUrl: affiliateHref,
    festivalId,
    type: "booking",
    source: "festival_detail",
  });
```

The rest of the component (JSX) stays unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `FestivalNearbyBookingCard.tsx` (it now reads two optional props; callers updated in Task 3).

- [ ] **Step 3: Commit**

```bash
git add components/festival/FestivalNearbyBookingCard.tsx
git commit -m "feat(festival): wrap nearby-booking link with affiliate attribution"
```

---

## Task 3: Thread props through FestivalDetailClient

**Files:**
- Modify: `components/festival/FestivalDetailClient.tsx`

- [ ] **Step 1: Add the props to the `Props` type**

In `components/festival/FestivalDetailClient.tsx`, inside the `type Props = { ... }` block (starts at line ~71), add:

```ts
  bookingAffiliateAid?: string | null;
  bookingAffiliateLabelPrefix?: string | null;
```

- [ ] **Step 2: Destructure them in the function signature**

In `export default function FestivalDetailClient({ ... })` (starts at line ~205), add the two new names to the destructured parameter list, e.g. alongside `showTravelPopularLabel`:

```ts
  showTravelPopularLabel,
  bookingAffiliateAid,
  bookingAffiliateLabelPrefix,
```

- [ ] **Step 3: Pass them to the card**

Find the `<FestivalNearbyBookingCard ... />` usage (line ~1218) and add the two props:

```tsx
            <FestivalNearbyBookingCard
              place={nearbyBookingPlace}
              startDate={festival.start_date}
              endDate={festival.end_date}
              festivalId={String(festival.id)}
              affiliateAid={bookingAffiliateAid}
              affiliateLabelPrefix={bookingAffiliateLabelPrefix}
            />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (page-level caller still owes the props — added in Task 4; props are optional so this stays green).

- [ ] **Step 5: Commit**

```bash
git add components/festival/FestivalDetailClient.tsx
git commit -m "feat(festival): pass booking affiliate props to nearby-booking card"
```

---

## Task 4: Read env in the server page and pass down

**Files:**
- Modify: `app/festivals/[slug]/page.tsx`

- [ ] **Step 1: Pass the env-derived props to `FestivalDetailClient`**

In `app/festivals/[slug]/page.tsx`, locate the `<FestivalDetailClient ... />` usage (line ~224) and add the two props (read directly from `process.env` inline — this is a server component, so env is available; no `NEXT_PUBLIC_` needed):

```tsx
          <FestivalDetailClient
            festival={data.festival}
            adminViewCounts={adminViewCounts}
            media={data.media}
            days={data.days}
            scheduleItems={data.scheduleItems}
            mapHref={mapHref}
            mapEmbedSrc={mapEmbedSrc}
            citySlug={citySlug}
            calendarMonth={calendarMonth}
            relatedFestivals={relatedFestivals}
            accommodationOffers={accommodationOffers}
            adminEditHref={adminEditHref}
            showTravelPopularLabel={showTravelPopularLabel}
            programItemPlanActions={!data.usedProgramDraftFallback}
            showPendingApprovalBadge={showPendingApprovalBadge}
            bookingAffiliateAid={process.env.BOOKING_AFFILIATE_AID ?? null}
            bookingAffiliateLabelPrefix={process.env.BOOKING_AFFILIATE_LABEL_PREFIX ?? null}
          />
```

- [ ] **Step 2: Typecheck + full test run**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test -- lib/outbound/affiliate.test.ts`
Expected: PASS.

- [ ] **Step 3: Manual smoke check (local)**

In `.env.local` set `BOOKING_AFFILIATE_AID=1234567`, run `npm run dev`, open any public festival detail page, and confirm the „Виж настаняване" button's resolved target (hover / inspect the `/out?...` link → its `url` param) contains `aid=1234567&label=festivo-<festivalId>`. Remove the test value afterwards (or keep a real one).

- [ ] **Step 4: Commit**

```bash
git add "app/festivals/[slug]/page.tsx"
git commit -m "feat(festival): supply booking affiliate id from env on detail page"
```

---

## Task 5: Document the env vars

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add to README env documentation**

In `README.md`, in the environment-variables section, add two rows/entries:

- `BOOKING_AFFILIATE_AID` — Booking.com affiliate id (from a direct Booking affiliate account or a Travelpayouts Booking program). When unset, the „Настаняване наблизо" link falls back to a plain (non-earning) Booking URL.
- `BOOKING_AFFILIATE_LABEL_PREFIX` — optional prefix for the per-festival Booking `label` (stats). Defaults to `festivo`.

- [ ] **Step 2: Add to the CLAUDE.md env table**

In `CLAUDE.md`, under "Environment variables (key)", add a row:

```
| `BOOKING_AFFILIATE_AID` · `BOOKING_AFFILIATE_LABEL_PREFIX` | Booking.com affiliate attribution for the festival „Настаняване наблизо" link. `AID` from direct Booking affiliate or Travelpayouts; unset → plain non-earning URL. `LABEL_PREFIX` defaults to `festivo` |
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document Booking affiliate env vars"
```

---

## Task 6: Finalize — PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/web-follow-buttons
```

> Note: work currently sits on `feat/web-follow-buttons`. If the maintainer prefers an isolated branch, create `feat/booking-affiliate` off `main` and cherry-pick the commits before pushing. Confirm branch choice at execution time.

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: Booking affiliate monetization for nearby-booking card" --body "$(cat <<'EOF'
## Proposed Change
- Summary: „Настаняване наблизо" Booking link now carries affiliate `aid` + per-festival `label` so the site earns commission. No-op fallback to the current plain URL when `BOOKING_AFFILIATE_AID` is unset.
- Why now: monetization — the link earned nothing previously.

## Impacted Docs
- README.md (env vars), CLAUDE.md (env table)
- docs/superpowers/specs/2026-06-24-booking-affiliate-monetization-design.md

## Checklist
- [ ] Schema: n/a (no DB change)
- [x] API contract: backward-compatible (props optional; /out unchanged)
- [x] Background jobs: n/a
- [x] Security: aid is public (in outbound URL); no service-role/RLS impact
- [x] SEO: no change to canonical/metadata
- [x] Mobile sync: n/a
- [x] Docs updated in this PR
- [x] CLAUDE.md updated
EOF
)"
```

- [ ] **Step 3: Merge**

```bash
gh pr merge --merge --delete-branch
```

> Reminder for the operator: the code ships safely with no `aid` set (plain URL). To start earning, register a Booking affiliate id (Travelpayouts is instant / no traffic threshold), then add `BOOKING_AFFILIATE_AID` in Vercel: `vercel env add BOOKING_AFFILIATE_AID production`.

---

## Self-Review Notes

- **Spec coverage:** helper (Task 1) ✓, card wiring (Task 2) ✓, env via props because card is a client component / aid is public (Tasks 3-4) ✓, env vars + docs (Task 5) ✓, invariants preserved — `/out`, `outbound_clicks`, `outboundClickHref`, visible UX untouched ✓, tests (Task 1) ✓, fail-safe fallback ✓.
- **Spec refinement:** spec described the helper as reading env directly; the plan makes it a **pure function** (takes `aid`/`labelPrefix` as args) and reads env in the server page instead — required because the card renders in a client component where `process.env.BOOKING_AFFILIATE_AID` is unavailable, and cleaner/more testable. `aid` is public, so passing it as a prop is safe.
- **Type consistency:** prop names consistent end-to-end — card props `affiliateAid`/`affiliateLabelPrefix`; client-component props `bookingAffiliateAid`/`bookingAffiliateLabelPrefix`; helper option keys `aid`/`labelPrefix`.
- **Out of scope (future PRs):** rental-car/transport cards via Travelpayouts; organizer VIP/promotion push; ticket affiliate.
