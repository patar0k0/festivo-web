import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { isAppRoleValue, type AppRole } from "@/lib/admin/appRoles";
import { assertCanSetAppRole, persistUserAppRole } from "@/lib/admin/adminUserRole";

type Body = {
  role?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const raw = body.role;
  if (raw == null || !isAppRoleValue(raw)) {
    return NextResponse.json({ error: "Невалидна роля." }, { status: 400 });
  }
  const nextRole: AppRole = raw;

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/[id]/role] Admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    await assertCanSetAppRole(adminClient, ctx.user.id, id, nextRole);
    await persistUserAppRole(adminClient, id, nextRole);

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "user_role_set",
        entity_type: "user",
        entity_id: id,
        route: `/admin/api/users/${id}/role`,
        method: "PATCH",
        details: { role: nextRole },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]/role] failed", { message, id });
    const status = message.includes("Не може") || message.includes("Не можете") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** @deprecated Use PATCH with JSON { role } */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (action === "grant_admin") {
    const patched = new Request(request.url, {
      method: "PATCH",
      headers: request.headers,
      body: JSON.stringify({ role: "admin" }),
    });
    return PATCH(patched, context);
  }
  if (action === "revoke_admin") {
    const patched = new Request(request.url, {
      method: "PATCH",
      headers: request.headers,
      body: JSON.stringify({ role: "user" }),
    });
    return PATCH(patched, context);
  }

  return NextResponse.json({ error: "Expected action: grant_admin | revoke_admin or use PATCH { role }" }, { status: 400 });
}
