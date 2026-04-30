import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

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
    console.error("[admin/api/users/[id]/reset-password] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const { data: authData, error: authErr } = await adminClient.auth.admin.getUserById(id);
    if (authErr || !authData?.user?.email) {
      return NextResponse.json({ error: "Липсва имейл за този акаунт." }, { status: 400 });
    }

    const email = authData.user.email;
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const redirectTo = `${origin.replace(/\/+$/, "")}/reset-password`;

    const { error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr) {
      console.error("[admin/api/users/[id]/reset-password] generateLink failed", { message: linkErr.message, id });
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "user_reset_password",
        entity_type: "user",
        entity_id: id,
        route: `/admin/api/users/${id}/reset-password`,
        method: "POST",
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]/reset-password] failed", { message, id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
