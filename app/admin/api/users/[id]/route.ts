import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminUserDetail, isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logUserSecurityAudit } from "@/lib/admin/userSecurityAuditLog";
import { assertCanApplyDestructiveUserAction, setUserSoftDeleted } from "@/lib/admin/adminUserAccount";
import { sanitizeDeletedReason } from "@/lib/admin/sanitizeDeletedReason";
import { getUserAppRole } from "@/lib/admin/adminUserRole";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    console.error("[admin/api/users/[id]] Admin client initialization failed", { message });
    return NextResponse.json({ error: "User detail is temporarily unavailable." }, { status: 500 });
  }

  try {
    const detail = await fetchAdminUserDetail(adminClient, id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]] GET failed", { message, id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isAuthUserId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let reason: string | null = null;
  try {
    const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
    const r = body?.reason;
    if (typeof r === "string" && r.trim()) {
      reason = sanitizeDeletedReason(r);
    }
  } catch {
    /* optional body */
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/[id]] DELETE admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const detail = await fetchAdminUserDetail(adminClient, id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (detail.deleted_at) {
      return NextResponse.json({ error: "Потребителят вече е деактивиран." }, { status: 400 });
    }

    const appRole = await getUserAppRole(adminClient, id);
    await assertCanApplyDestructiveUserAction(adminClient, { actorUserId: ctx.user.id, targetUserId: id }, appRole);

    await setUserSoftDeleted(adminClient, id, true, { actorUserId: ctx.user.id, reason });

    try {
      await logUserSecurityAudit({
        actorUserId: ctx.user.id,
        targetUserId: id,
        action: "user_soft_delete",
        route: `/admin/api/users/${id}`,
        method: "DELETE",
        metadata: { email: detail.email, reason: reason ?? undefined },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]] DELETE failed", { message, id });
    const status = message.includes("Не може") || message.includes("Не можете") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
