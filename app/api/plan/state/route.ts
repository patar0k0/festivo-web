import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { getPlanStateByUser } from "@/lib/plan/server";

export async function GET(request: Request) {
  const ua = request.headers.get("user-agent") || "";

  const isInternal =
    ua.includes("vercel") ||
    ua.includes("node") ||
    ua.includes("curl") ||
    ua.includes("undici");

  if (isInternal) {
    return Response.json({ ok: true });
  }

  const user = await getOptionalUser();

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
    return NextResponse.json({ authenticated: false, scheduleItemIds: [], festivalIds: [], reminders: {} });
  }

  const state = await getPlanStateByUser();
  return NextResponse.json({ authenticated: true, ...state });
}
