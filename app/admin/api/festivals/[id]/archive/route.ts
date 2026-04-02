import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type Payload = {
  action?: "archive" | "restore";
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const action = body.action === "restore" ? "restore" : "archive";

  if (action === "archive") {
    console.info(`[festival-archive] festival_id=${id} start`);

    const { error } = await ctx.supabase
      .from("festivals")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.info(`[festival-archive] festival_id=${id} ok`);

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "festival.archived",
        entity_type: "festival",
        entity_id: id,
        route: "/admin/api/festivals/[id]/archive",
        method: "POST",
        details: {},
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[admin/audit] festival.archived failed", { message });
    }

    return NextResponse.json({ ok: true, archived: true });
  }

  const { error } = await ctx.supabase
    .from("festivals")
    .update({ status: "verified", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival.restored",
      entity_type: "festival",
      entity_id: id,
      route: "/admin/api/festivals/[id]/archive",
      method: "POST",
      details: {},
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] festival.restored failed", { message });
  }

  return NextResponse.json({ ok: true, restored: true });
}
