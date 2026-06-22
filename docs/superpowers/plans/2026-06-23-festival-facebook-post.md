# Festival → Facebook Post button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Публикувай във Facebook" button on the admin festival edit page that publishes a link post about the festival to the Festivo Facebook Page (editable caption), and records the post id + timestamp.

**Architecture:** The web admin posts **directly and synchronously** to the Facebook Graph API from a service-role admin route (no worker queue). A pure helper builds and sends the Graph request; the route guards admin access, builds the canonical festival link server-side, calls the helper, and persists `facebook_post_id` + `facebook_posted_at` on the `festivals` row. The edit form gets a button + dialog with an editable caption.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (service-role admin client via `getAdminContext`), Facebook Graph API v21.0, Vitest, Tailwind, `sonner` toasts.

Spec: `docs/superpowers/specs/2026-06-23-festival-facebook-post-design.md`

---

## File Structure

**Create:**
- `scripts/sql/20260623_festival_facebook_post.sql` — add `facebook_post_id`, `facebook_posted_at` to `festivals`.
- `lib/admin/facebook/postToPage.ts` — pure Graph helper (`postFestivalLinkToPage`).
- `lib/admin/facebook/postToPage.test.ts` — Vitest unit tests for the helper.
- `app/admin/api/festivals/[id]/facebook-post/route.ts` — admin POST route.

**Modify:**
- `components/admin/FestivalEditForm.tsx` — add `facebook_post_id`/`facebook_posted_at` to the `FestivalRecord` type, the button, and the publish dialog.
- `CLAUDE.md` — env vars + short feature note.
- `README.md` — document `FB_PAGE_ID` / `FB_PAGE_ACCESS_TOKEN` / `FB_GRAPH_VERSION`.

**No change needed:**
- `app/admin/(protected)/festivals/[id]/page.tsx` already selects `*`, so `facebook_post_id`/`facebook_posted_at` flow into the form automatically once the columns exist.

---

## Task 1: Schema migration

**Files:**
- Create: `scripts/sql/20260623_festival_facebook_post.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260623_festival_facebook_post.sql
-- Track manual Facebook Page posts made from the admin festival edit page.

alter table public.festivals
  add column if not exists facebook_post_id text,
  add column if not exists facebook_posted_at timestamptz;

comment on column public.festivals.facebook_post_id is
  'Graph API post id of the most recent manual Facebook Page post (admin edit page).';
comment on column public.festivals.facebook_posted_at is
  'Timestamp of the most recent manual Facebook Page post.';

-- No new RLS policies: these columns are written only by the service-role
-- admin route; existing festivals RLS is unchanged. No index: not used in
-- filter/sort paths.
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` (name `festival_facebook_post`) or the project's normal migration runner against the Supabase project.

Verify (Supabase MCP `list_tables`, schema `public`, table `festivals`): expect `facebook_post_id` and `facebook_posted_at` columns present.

- [ ] **Step 3: Commit**

```bash
git add scripts/sql/20260623_festival_facebook_post.sql
git commit -m "chore(db): add facebook_post_id/facebook_posted_at to festivals"
```

---

## Task 2: Graph helper `postFestivalLinkToPage`

**Files:**
- Create: `lib/admin/facebook/postToPage.ts`
- Test: `lib/admin/facebook/postToPage.test.ts`

The helper is pure except for reading env and calling `fetch`. `fetch` is injected for tests. Env: `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, optional `FB_GRAPH_VERSION` (default `v21.0`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/admin/facebook/postToPage.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { postFestivalLinkToPage } from "./postToPage";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env.FB_PAGE_ID = "12345";
  process.env.FB_PAGE_ACCESS_TOKEN = "TOKEN";
  delete process.env.FB_GRAPH_VERSION;
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("postFestivalLinkToPage", () => {
  it("POSTs message+link+token to /{pageId}/feed and returns the post id", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ id: "12345_67890" }) } as Response;
    };

    const out = await postFestivalLinkToPage(
      { message: "Здравей", link: "https://festivo.bg/festivals/test" },
      { fetchImpl },
    );

    expect(out.postId).toBe("12345_67890");
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/12345/feed");
    expect(calls[0].body).toEqual({
      message: "Здравей",
      link: "https://festivo.bg/festivals/test",
      access_token: "TOKEN",
    });
  });

  it("honours FB_GRAPH_VERSION override", async () => {
    process.env.FB_GRAPH_VERSION = "v20.0";
    let seenUrl = "";
    const fetchImpl = async (url: string) => {
      seenUrl = url;
      return { ok: true, status: 200, json: async () => ({ id: "x" }) } as Response;
    };
    await postFestivalLinkToPage(
      { message: "m", link: "https://festivo.bg/festivals/x" },
      { fetchImpl },
    );
    expect(seenUrl).toBe("https://graph.facebook.com/v20.0/12345/feed");
  });

  it("throws with the Graph error message on a non-OK response", async () => {
    const fetchImpl = async () =>
      ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Invalid token" } }),
      }) as Response;

    await expect(
      postFestivalLinkToPage(
        { message: "m", link: "https://festivo.bg/festivals/x" },
        { fetchImpl },
      ),
    ).rejects.toThrow(/Invalid token/);
  });

  it("throws when env is not configured", async () => {
    delete process.env.FB_PAGE_ID;
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response;
    await expect(
      postFestivalLinkToPage(
        { message: "m", link: "https://festivo.bg/festivals/x" },
        { fetchImpl },
      ),
    ).rejects.toThrow(/FB_PAGE_ID/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/facebook/postToPage.test.ts`
Expected: FAIL — cannot find module `./postToPage`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/admin/facebook/postToPage.ts

export type PostToPageInput = {
  /** Caption text shown above the link preview card. */
  message: string;
  /** Canonical festival URL — Facebook renders the OG preview from it. */
  link: string;
};

export type PostToPageDeps = {
  fetchImpl?: typeof fetch;
};

export type PostToPageResult = {
  postId: string;
};

/**
 * Publish a link post to the Festivo Facebook Page via the Graph API.
 * Mirrors the env-based token approach used by the festivo-workers
 * weekend-post publisher, but for a /feed link post (no image upload).
 */
export async function postFestivalLinkToPage(
  { message, link }: PostToPageInput,
  deps: PostToPageDeps = {},
): Promise<PostToPageResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const version = process.env.FB_GRAPH_VERSION?.trim() || "v21.0";
  const pageId = process.env.FB_PAGE_ID?.trim();
  const token = process.env.FB_PAGE_ACCESS_TOKEN?.trim();

  if (!pageId || !token) {
    throw new Error("FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN not configured");
  }

  const endpoint = `https://graph.facebook.com/${version}/${pageId}/feed`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, link, access_token: token }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`facebook publish failed: ${msg}`);
  }

  return { postId: json.id ?? "" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/facebook/postToPage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/facebook/postToPage.ts lib/admin/facebook/postToPage.test.ts
git commit -m "feat(admin): facebook page link-post graph helper"
```

---

## Task 3: Admin API route

**Files:**
- Create: `app/admin/api/festivals/[id]/facebook-post/route.ts`

Follows the auth/audit pattern from `app/admin/api/festivals/[id]/archive/route.ts`. The link is built server-side from the DB slug — never trusted from the client.

- [ ] **Step 1: Write the route**

```ts
// app/admin/api/festivals/[id]/facebook-post/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { getBaseUrl } from "@/lib/config/baseUrl";
import { postFestivalLinkToPage } from "@/lib/admin/facebook/postToPage";

type Payload = {
  message?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const message = (body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Текстът на поста е празен." }, { status: 400 });
  }

  const { data: festival, error: loadError } = await ctx.supabase
    .from("festivals")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!festival?.slug) {
    return NextResponse.json({ error: "Фестивалът не е намерен." }, { status: 404 });
  }

  const link = `${getBaseUrl().replace(/\/$/, "")}/festivals/${encodeURIComponent(festival.slug)}`;

  let postId = "";
  try {
    const result = await postFestivalLinkToPage({ message, link });
    postId = result.postId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Публикуването се провали.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const postedAt = new Date().toISOString();
  const { error: updateError } = await ctx.supabase
    .from("festivals")
    .update({ facebook_post_id: postId, facebook_posted_at: postedAt, updated_at: postedAt })
    .eq("id", id);

  if (updateError) {
    // The post is live but we failed to record it — report so the admin knows.
    return NextResponse.json(
      { error: `Публикувано, но записът се провали: ${updateError.message}`, postId, postedAt },
      { status: 500 },
    );
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival.facebook_posted",
      entity_type: "festival",
      entity_id: id,
      route: "/admin/api/festivals/[id]/facebook-post",
      method: "POST",
      details: { postId },
    });
  } catch (auditError) {
    const m = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] festival.facebook_posted failed", { m });
  }

  return NextResponse.json({ ok: true, postId, postedAt });
}
```

- [ ] **Step 2: Type-check the route**

Run: `npx tsc --noEmit`
Expected: no new errors from this file. (If `festivals` row typing complains about the new columns, regenerate Supabase types or cast the update payload — see note below.)

> Note: if the project uses generated Supabase types (`lib/types/database.ts`) and `tsc` errors on `facebook_post_id`/`facebook_posted_at`, regenerate them via the Supabase MCP `generate_typescript_types` after Task 1, or add the two optional columns to the `festivals` Row/Update types manually in the same commit.

- [ ] **Step 3: Commit**

```bash
git add app/admin/api/festivals/[id]/facebook-post/route.ts
git commit -m "feat(admin): API route to publish a festival to Facebook"
```

---

## Task 4: UI — button + dialog in FestivalEditForm

**Files:**
- Modify: `components/admin/FestivalEditForm.tsx`

- [ ] **Step 1: Extend the `FestivalRecord` type**

In `components/admin/FestivalEditForm.tsx`, add to the `FestivalRecord` type (after `source_type` around line 80):

```ts
  facebook_post_id?: string | null;
  facebook_posted_at?: string | null;
```

- [ ] **Step 2: Add component state and the publish handler**

Near the other `useState` hooks (around line 355, next to `actionPending`), add:

```ts
  const [fbDialogOpen, setFbDialogOpen] = useState(false);
  const [fbPosting, setFbPosting] = useState(false);
  const [fbPostId, setFbPostId] = useState<string | null>(festival.facebook_post_id ?? null);
  const [fbPostedAt, setFbPostedAt] = useState<string | null>(festival.facebook_posted_at ?? null);
```

Then add this default-caption builder and handler (place near `runArchiveAction`, around line 872):

```ts
  const defaultFacebookMessage = useMemo(() => {
    const parts: string[] = [];
    if (form.title?.trim()) parts.push(form.title.trim());
    const cityLabel = festival.city_name || form.city || "";
    const datePart = form.start_date
      ? new Date(form.start_date).toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const tail = [cityLabel, datePart].filter(Boolean).join(", ");
    return tail ? `${parts.join("")} — ${tail}` : parts.join("");
  }, [form.title, form.city, form.start_date, festival.city_name]);

  const [fbMessage, setFbMessage] = useState(defaultFacebookMessage);

  const openFacebookDialog = () => {
    setFbMessage(defaultFacebookMessage);
    setFbDialogOpen(true);
  };

  const runFacebookPost = async () => {
    if (fbPosting) return;
    const message = fbMessage.trim();
    if (!message) {
      toast.error("Текстът на поста е празен.");
      return;
    }
    setFbPosting(true);
    try {
      const response = await fetch(`/admin/api/festivals/${festival.id}/facebook-post`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        postId?: string;
        postedAt?: string;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Публикуването се провали.");
      }
      setFbPostId(data.postId ?? null);
      setFbPostedAt(data.postedAt ?? new Date().toISOString());
      setFbDialogOpen(false);
      toast.success("Публикувано във Facebook.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Възникна грешка.");
    } finally {
      setFbPosting(false);
    }
  };
```

> `useMemo` is already imported (line 4). `toast` is already imported (line 49). If `useMemo` is unused elsewhere and lint complains, it is now used here.

- [ ] **Step 3: Add the button in the secondary-actions row**

In the secondary-actions `<div className="flex items-center gap-2">` (around line 1703), add a button before the "Откажи" `Link`:

```tsx
            <button
              type="button"
              onClick={openFacebookDialog}
              disabled={savingForm || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || videoBusy}
              className="rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#1877F2] disabled:opacity-50"
            >
              {fbPostedAt ? "Публикувай отново във FB" : "Публикувай във Facebook"}
            </button>
```

- [ ] **Step 4: Add the dialog markup**

Just before the closing `</form>` (around line 1735), add:

```tsx
      {fbDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-black/[0.08] bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">Публикувай във Facebook</h3>
            {fbPostedAt && (
              <p className="mt-2 rounded-lg bg-[#fff7ed] px-3 py-2 text-xs text-[#b13a1a]">
                Вече публикувано на {new Date(fbPostedAt).toLocaleString("bg-BG")}
                {fbPostId && (
                  <>
                    {" — "}
                    <a
                      href={`https://www.facebook.com/${fbPostId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      виж поста
                    </a>
                  </>
                )}
              </p>
            )}
            <p className="mt-3 text-xs text-black/60">
              Линкът към фестивала се добавя автоматично — Facebook ще покаже визитка с картинка от страницата.
            </p>
            <textarea
              value={fbMessage}
              onChange={(e) => setFbMessage(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-xl border border-black/[0.1] p-3 text-sm"
              placeholder="Текст на поста…"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFbDialogOpen(false)}
                disabled={fbPosting}
                className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
              >
                Откажи
              </button>
              <button
                type="button"
                onClick={runFacebookPost}
                disabled={fbPosting}
                className="rounded-xl bg-[#1877F2] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
              >
                {fbPosting ? "Публикуване…" : "Публикувай"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npx next lint --file components/admin/FestivalEditForm.tsx`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/admin/FestivalEditForm.tsx
git commit -m "feat(admin): Facebook publish button + dialog on festival edit"
```

---

## Task 5: Env + docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Add env vars to the CLAUDE.md env table**

In `CLAUDE.md`, in the "Environment variables (key)" table, add rows:

```md
| `FB_PAGE_ID` · `FB_PAGE_ACCESS_TOKEN` | Facebook Page id + long-lived/System-User Page access token for posting festivals/weekend roundups to the Festivo Page (Graph API). Shared with festivo-workers. |
| `FB_GRAPH_VERSION` | Graph API version override (default `v21.0`) |
```

- [ ] **Step 2: Add a short feature note to CLAUDE.md**

Add a brief subsection (e.g. under the admin/moderation area) noting:

```md
## Publish festival to Facebook (admin)

The admin festival edit page (`/admin/festivals/[id]`) has a "Публикувай във Facebook" button that publishes a **link post** about the festival to the Festivo Facebook Page via the Graph API (`POST /{FB_PAGE_ID}/feed`, `message` + canonical `link`). The post is sent synchronously from `app/admin/api/festivals/[id]/facebook-post/route.ts` using `lib/admin/facebook/postToPage.ts`; on success `festivals.facebook_post_id` + `facebook_posted_at` are recorded. Token via `FB_PAGE_ID` / `FB_PAGE_ACCESS_TOKEN` (same env token used by the festivo-workers weekend-post publisher). Re-posting is allowed and overwrites the recorded id/timestamp.
```

- [ ] **Step 3: Document env vars in README**

In `README.md`, add `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `FB_GRAPH_VERSION` to the environment-variables section with the same descriptions.

- [ ] **Step 4: Add the vars to Vercel production**

(Operational — not a code step.) Ensure the same token used in Railway is set in Vercel:

```bash
vercel env add FB_PAGE_ID production
vercel env add FB_PAGE_ACCESS_TOKEN production
# FB_GRAPH_VERSION optional
```

Also add `FB_PAGE_ID` / `FB_PAGE_ACCESS_TOKEN` to local `.env.local` for dev.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document FB page posting env vars + feature"
```

---

## Task 6: Manual end-to-end verification

**Files:** none (operational).

- [ ] **Step 1: Confirm env** — `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `NEXT_PUBLIC_SITE_URL` set locally.

- [ ] **Step 2:** Run the app (`npm run dev`), open `/admin/festivals/<an approved festival id>`.

- [ ] **Step 3:** Click "Публикувай във Facebook" → confirm the dialog pre-fills `{title} — {city}, {date}`. Edit the text, click "Публикувай".

- [ ] **Step 4:** Expect a success toast. Open the Festivo Facebook Page → confirm a link post appears with the festival's OG preview card.

- [ ] **Step 5:** Reload the edit page → the button now reads "Публикувай отново във FB"; the dialog shows "Вече публикувано на …" with a working "виж поста" link.

- [ ] **Step 6:** In Supabase, confirm the `festivals` row has `facebook_post_id` + `facebook_posted_at` set, and `admin_audit_logs` has a `festival.facebook_posted` entry.

---

## Self-Review notes

- **Spec coverage:** schema (Task 1) ✓; server Graph helper (Task 2) ✓; admin API route with server-side link + DB write + audit (Task 3) ✓; button + editable dialog + already-posted warning + re-post (Task 4) ✓; env + docs (Task 5) ✓; error handling — missing env / Graph error / empty message all covered in helper + route (Tasks 2–3) ✓; security — admin guard, server-side link, token server-only (Task 3) ✓.
- **Deviation from spec (intentional):** the default caption is `{title} — {city}, {date}` **without** the raw link in the textarea; the route always attaches the canonical `link` separately so Facebook renders the preview card and the URL is not duplicated in the caption. The link is still published, matching intent.
- **Type consistency:** `postFestivalLinkToPage({ message, link }) -> { postId }` used identically in helper (Task 2), route (Task 3). Columns `facebook_post_id` / `facebook_posted_at` named identically across migration (Task 1), route update (Task 3), `FestivalRecord` type + state (Task 4). Response shape `{ ok, postId, postedAt }` consistent between route (Task 3) and client handler (Task 4).
- **Test runner:** new tests use Vitest imports to match `vitest.config.ts` (`include: lib/**/*.test.ts`), guaranteeing collection.
