import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { getPlanStateByUser } from "@/lib/plan/server";

// Explicit — this endpoint reads auth cookies and must never be statically
// generated or edge-cached. Without this, Next.js auto-detects dynamic via the
// cookies() call, but declaring it is cheap insurance against future refactors
// accidentally making it static.
export const dynamic = "force-dynamic";

const EMPTY_GUEST_PAYLOAD = {
  authenticated: false,
  scheduleItemIds: [],
  festivalIds: [],
  reminders: {},
} as const;

export async function GET(request: Request) {
  const ua = request.headers.get("user-agent") || "";

  const isInternal =
    ua.includes("vercel") ||
    ua.includes("node") ||
    ua.includes("curl") ||
    ua.includes("undici");

  if (isInternal) {
    // Internal probes (Vercel build, monitoring) still get a *valid* plan-state
    // shape. Previously we returned `{ ok: true }` which, if a real browser ever
    // hit this branch (e.g. a future UA contains "node"), would crash the client
    // applyState() call (`undefined.map`) and leave the user stuck in guest UI.
    return NextResponse.json(EMPTY_GUEST_PAYLOAD);
  }

  // We deliberately catch errors from getOptionalUser here. If the optional
  // soft-delete check throws (transient DB error, RLS hiccup), we'd otherwise
  // 500 — which the client treats as "skip update", leaving logged-in users
  // stuck in guest view on the festival detail / plan page. Safer to degrade
  // to the guest payload; mutating endpoints still enforce auth properly.
  let user;
  try {
    user = await getOptionalUser();
  } catch (err) {
    console.error("[/api/plan/state] getOptionalUser failed", err);
    return NextResponse.json(EMPTY_GUEST_PAYLOAD);
  }

  if (!user) {
    // Anonymous visitors are a *normal* state for this endpoint, not an error
    // condition — `/api/plan/state` represents "the plan view for the current
    // session", and "no session" is a valid view (empty arrays + the explicit
    // `authenticated: false` flag the client switches on).
    //
    // We previously returned 401 here, which Chrome surfaces as a
    // `Failed to load resource: 401` console error on every page load for
    // logged-out traffic (~95% of festivo.bg visitors). That noise drops the
    // Lighthouse Best Practices score and masks real auth regressions.
    //
    // Mutating endpoints (`/api/plan/items`, `/api/plan/festivals`,
    // `/api/plan/reminders`) keep their 401 — they *do* require an actual
    // identity.
    return NextResponse.json(EMPTY_GUEST_PAYLOAD);
  }

  try {
    const state = await getPlanStateByUser();
    return NextResponse.json({ authenticated: true, ...state });
  } catch (err) {
    // If plan-state fetch fails for a logged-in user, return authenticated:true
    // with empty arrays. The UI still shows the correct "logged in" state and
    // can refetch later — much better than reverting to guest view.
    console.error("[/api/plan/state] getPlanStateByUser failed", err);
    return NextResponse.json({
      authenticated: true,
      scheduleItemIds: [],
      festivalIds: [],
      reminders: {},
    });
  }
}
