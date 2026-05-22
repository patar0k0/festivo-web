import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminUserDetail, isAuthUserId } from "@/lib/admin/adminUserDetail";
import { validateHardDeleteConfirmEmailFromUsersTable } from "@/lib/admin/hardDeleteConfirmEmail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logUserSecurityAudit } from "@/lib/admin/userSecurityAuditLog";
import { assertCanApplyDestructiveUserAction } from "@/lib/admin/adminUserAccount";
import { getUserAppRole } from "@/lib/admin/adminUserRole";
import { hardDeleteAuthUser } from "@/lib/admin/hardDeleteAuthUser";
import { invalidateCachedUserGateSafe } from "@/lib/middlewareUserGateCache";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  // Production access is gated by:
  //  1. getAdminContext (admin role required)
  //  2. assertCanApplyDestructiveUserAction (no self-delete, no super_admin → super_admin)
  //  3. Double confirmation: client must send confirm_phrase === "DELETE" AND
  //     confirm_email matching the user's email in public.users
  //  4. Audit log entry (user_hard_delete) for every successful invocation
  // The earlier `NODE_ENV !== "development"` guard was a belt-and-suspenders
  // safeguard from early development; the above protections are sufficient.

  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isAuthUserId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let confirmEmail = "";
  let confirmPhrase = "";
  try {
    const body = (await request.json()) as { confirm_email?: string; confirm_phrase?: string };
    confirmEmail = typeof body.confirm_email === "string" ? body.confirm_email.trim() : "";
    confirmPhrase = typeof body.confirm_phrase === "string" ? body.confirm_phrase.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (confirmPhrase !== "DELETE") {
    return NextResponse.json({ error: "Напишете точно DELETE за потвърждение." }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/[id]/hard] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const emailCheck = await validateHardDeleteConfirmEmailFromUsersTable(adminClient, id, confirmEmail);
    if (!emailCheck.ok) {
      return NextResponse.json({ error: emailCheck.message }, { status: emailCheck.status });
    }

    const detail = await fetchAdminUserDetail(adminClient, id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const appRole = await getUserAppRole(adminClient, id);
    await assertCanApplyDestructiveUserAction(adminClient, { actorUserId: ctx.user.id, targetUserId: id }, appRole);

    await hardDeleteAuthUser(adminClient, id);
    invalidateCachedUserGateSafe(id, "admin_users_hard_delete");

    await logUserSecurityAudit({
      actorUserId: ctx.user.id,
      targetUserId: id,
      action: "user_hard_delete",
      route: `/admin/api/users/${id}/hard`,
      method: "DELETE",
      metadata: { email: emailCheck.dbEmail },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]/hard] failed", { message, id });
    const status = message.includes("Не може") || message.includes("Не можете") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
