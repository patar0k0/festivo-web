import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type Body = {
  verified?: boolean;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isAuthUserId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const verified = Boolean(body.verified);

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/[id]/email-verified] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const { error } = await adminClient.auth.admin.updateUserById(id, {
      email_confirm: verified,
    });

    if (error) {
      console.error("[admin/api/users/[id]/email-verified] update failed", { message: error.message, id });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "user_email_verified_toggle",
        entity_type: "user",
        entity_id: id,
        route: `/admin/api/users/${id}/email-verified`,
        method: "POST",
        details: { verified },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]/email-verified] failed", { message, id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
