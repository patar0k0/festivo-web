import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { reviewed?: unknown };
  try {
    body = (await request.json()) as { reviewed?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.reviewed !== "boolean") {
    return NextResponse.json({ error: "reviewed must be boolean" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("festival_reports")
    .update({
      reviewed: body.reviewed,
      reviewed_at: body.reviewed ? new Date().toISOString() : null,
      reviewed_by: body.reviewed ? ctx.user.id : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival_report_reviewed",
      entity_type: "festival_report",
      entity_id: id,
      route: `/admin/api/festival-reports/${id}`,
      method: "PATCH",
      details: { reviewed: body.reviewed },
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true });
}
