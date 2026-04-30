import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminUserDetail, isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { setUserSoftDeleted } from "@/lib/admin/adminUserAccount";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isAuthUserId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/[id]/restore] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const detail = await fetchAdminUserDetail(adminClient, id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!detail.deleted_at) {
      return NextResponse.json({ error: "Потребителят не е деактивиран." }, { status: 400 });
    }

    await setUserSoftDeleted(adminClient, id, false);

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "user_restore",
        entity_type: "user",
        entity_id: id,
        route: `/admin/api/users/${id}/restore`,
        method: "POST",
        details: { email: detail.email },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]/restore] failed", { message, id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
