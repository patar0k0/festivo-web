import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import { isAnalyticsEvent } from "@/lib/analytics/types";

type AnalyticsTrackBody = {
  event?: string;
  notification_id?: string | null;
  festival_id?: string | null;
  slug?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

const BOT_UA_REGEX =
  /(?:Googlebot|bingbot|YandexBot|Baiduspider|AhrefsBot|SemrushBot|DotBot|MJ12bot|PetalBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Pinterest|HeadlessChrome|Lighthouse|curl\/|wget\/|python-requests|node-fetch)/i;

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

function toOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Returns true if the JWT app_metadata.role marks this session as admin
 * (cheap path, no DB read). Used to short-circuit before doing a user_roles
 * lookup.
 */
function jwtRoleIsAdmin(role: unknown): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * For `festival_view` events from logged-in users, swallows the event when:
 *  - The user has an admin / super_admin role (JWT first, user_roles fallback)
 *  - The user already has a `festival_view` for this `festival_id` in the
 *    last 24h (per-user dedup so refreshes don't inflate counts).
 *
 * Returns true when the event should be silently dropped, false when it
 * should proceed to insert. Fail-open: throws are caught and return false.
 */
async function shouldDropFestivalView(args: {
  userId: string;
  userJwtRole: unknown;
  festivalId: string | null;
}): Promise<boolean> {
  if (jwtRoleIsAdmin(args.userJwtRole)) return true;

  try {
    const supabaseAdmin = createSupabaseAdmin();

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", args.userId);
    if (!roleError && Array.isArray(roleRows)) {
      const isStaff = roleRows.some(
        (r) => r.role === "admin" || r.role === "super_admin",
      );
      if (isStaff) return true;
    }

    if (args.festivalId) {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
      const { data: existing, error: dedupError } = await supabaseAdmin
        .from("analytics_events")
        .select("id")
        .eq("user_id", args.userId)
        .eq("festival_id", args.festivalId)
        .eq("event", "festival_view")
        .gte("created_at", since)
        .limit(1);
      if (!dedupError && existing && existing.length > 0) {
        return true;
      }
    }
  } catch (err) {
    console.warn("[analytics] shouldDropFestivalView threw; failing open", err);
  }

  return false;
}

export async function POST(request: Request) {
  let body: AnalyticsTrackBody;
  try {
    body = (await request.json()) as AnalyticsTrackBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : null;
  if (!event || !isAnalyticsEvent(event)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing event" }, { status: 400 });
  }

  // Bot UA: silently drop. Always-on for every event type (push_open from a
  // Slackbot preview is also noise).
  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT_UA_REGEX.test(userAgent)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const notification_id = toOptionalTrimmedString(body.notification_id);
  const festival_id = toOptionalTrimmedString(body.festival_id);
  const slug = toOptionalTrimmedString(body.slug);
  const source = toOptionalTrimmedString(body.source);
  const metadata_json = body.metadata && typeof body.metadata === "object" ? body.metadata : null;

  let user_id: string | null = null;
  let user_jwt_role: unknown = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const u = authData?.user ?? null;
    user_id = u?.id ?? null;
    user_jwt_role = u?.app_metadata?.role ?? null;
  } catch (err) {
    // Anonymous tracking is allowed; do not block.
    console.warn("[analytics] session read failed; tracking anonymously", err);
  }

  // Staff exclusion + per-user 24h dedup — only for festival_view from logged-in
  // users. Other events (push_open, app_open) keep their existing semantics.
  if (event === "festival_view" && user_id) {
    const drop = await shouldDropFestivalView({
      userId: user_id,
      userJwtRole: user_jwt_role,
      festivalId: festival_id,
    });
    if (drop) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  const created_at = new Date().toISOString();
  const payload = {
    user_id,
    event: event as AnalyticsEvent,
    notification_id,
    festival_id,
    slug,
    source,
    metadata_json,
    created_at,
  };

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const { error: insertError } = await supabaseAdmin.from("analytics_events").insert(payload);
    if (insertError) {
      console.warn("[analytics] insert failed", { event, message: insertError.message });
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Fail-safe: do not block client flows for analytics.
    console.warn("[analytics] insert threw", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
