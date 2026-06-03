import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/admin/isAdmin";
import { uncancelFestival } from "@/lib/festival/cancelFestival";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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
