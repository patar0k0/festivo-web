import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { invalidateAuthSessions } from "@/lib/admin/adminUserAccount";

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
    console.error("[admin/api/users/[id]/force-logout] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    await invalidateAuthSessions(adminClient, id);

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "user_force_logout",
        entity_type: "user",
        entity_id: id,
        route: `/admin/api/users/${id}/force-logout`,
        method: "POST",
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]/force-logout] failed", { message, id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
