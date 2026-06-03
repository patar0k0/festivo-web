import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/admin/isAdmin";
import { cancelFestival } from "@/lib/festival/cancelFestival";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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
