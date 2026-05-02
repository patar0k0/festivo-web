import { NextResponse } from "next/server";
import { assertCanApplyDestructiveUserAction } from "@/lib/admin/adminUserAccount";
import { fetchAdminUserDetail, isAuthUserId } from "@/lib/admin/adminUserDetail";
import { validateHardDeleteConfirmEmailFromUsersTable } from "@/lib/admin/hardDeleteConfirmEmail";
import { getUserAppRole } from "@/lib/admin/adminUserRole";
import { hardDeleteAuthUser } from "@/lib/admin/hardDeleteAuthUser";
import { hasAdminRole } from "@/lib/admin/isAdmin";
import { logUserSecurityAudit } from "@/lib/admin/userSecurityAuditLog";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";
import { invalidateCachedUserGateSafe } from "@/lib/middlewareUserGateCache";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Production hard delete: removes Auth user (`auth.admin.deleteUser`) after app data purge
 * so the email can be reused. Requires staff admin + same confirmations as dev `DELETE .../admin/api/users/[id]/hard`.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let actorUserId: string;
  try {
    const { user, supabase } = await requireActiveUserWithSupabase();
    if (!(await hasAdminRole(supabase, user.id, user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    actorUserId = user.id;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[api/admin/users/[id]/hard-delete] auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
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
    console.error("[api/admin/users/[id]/hard-delete] admin client init failed", { message });
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
    await assertCanApplyDestructiveUserAction(adminClient, { actorUserId, targetUserId: id }, appRole);

    await hardDeleteAuthUser(adminClient, id);
    invalidateCachedUserGateSafe(id, "api_admin_users_hard_delete");

    await logUserSecurityAudit({
      actorUserId,
      targetUserId: id,
      action: "user_hard_delete",
      route: `/api/admin/users/${id}/hard-delete`,
      method: "DELETE",
      metadata: { email: emailCheck.dbEmail },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[api/admin/users/[id]/hard-delete] failed", { message, id });
    const status = message.includes("Не може") || message.includes("Не можете") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
