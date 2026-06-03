import { NextResponse } from "next/server";

import { cancelFestival } from "@/lib/festival/cancelFestival";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";

export const runtime = "nodejs";

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

  // Verify festival belongs to an organizer where user is owner
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
