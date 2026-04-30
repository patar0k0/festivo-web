import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { adminSyncUserBannedUntil } from "@/lib/admin/syncUserBannedUntil";
import { logAdminAction } from "@/lib/admin/audit-log";
import { logUserSecurityAudit } from "@/lib/admin/userSecurityAuditLog";
import { invalidateCachedUserGateSafe } from "@/lib/middlewareUserGateCache";

type Body = {
  action?: string;
};

const BAN_DURATION = "87600h";

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

  const action = body.action;
  if (action !== "ban" && action !== "unban") {
    return NextResponse.json({ error: "Expected action: ban | unban" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/[id]/ban] Admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(id, {
    ban_duration: action === "ban" ? BAN_DURATION : "none",
  });

  if (error) {
    console.error("[admin/api/users/[id]/ban] updateUserById failed", { message: error.message, id, action });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const untilIso = action === "ban" ? (data.user.banned_until ?? null) : null;
  try {
    await adminSyncUserBannedUntil(adminClient, id, untilIso);
  } catch (syncErr) {
    const m = syncErr instanceof Error ? syncErr.message : String(syncErr);
    console.error("[admin/api/users/[id]/ban] DB banned_until sync failed", { id, message: m });
    if (action === "ban") {
      const { error: rollbackErr } = await adminClient.auth.admin.updateUserById(id, { ban_duration: "none" });
      if (rollbackErr) {
        console.error("[admin/api/users/[id]/ban] Auth rollback after sync failure failed", {
          id,
          message: rollbackErr.message,
        });
        const { error: flagErr } = await adminClient.from("users").update({ ban_sync_error: true }).eq("id", id);
        if (flagErr) {
          console.error("[admin/api/users/[id]/ban] ban_sync_error flag failed", { id, message: flagErr.message });
        }
        await logAdminAction({
          actor_user_id: ctx.user.id,
          action: "ban_sync_rollback_failed",
          entity_type: "user",
          entity_id: id,
          route: `/admin/api/users/${id}/ban`,
          method: "POST",
          details: { sync_error: m, rollback_error: rollbackErr.message },
        });
        return NextResponse.json(
          {
            error:
              "Критична грешка: състоянието на бана е несъгласувано. Свържете се с администратор.",
          },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ error: "Auth актуализиран, но записът в базата не успя. Опитайте отново." }, { status: 500 });
  }

  invalidateCachedUserGateSafe(id, "admin_users_ban_unban");

  await logUserSecurityAudit({
    actorUserId: ctx.user.id,
    targetUserId: id,
    action: "user_ban",
    route: `/admin/api/users/${id}/ban`,
    method: "POST",
    metadata: { action, email: data.user.email },
  });

  return NextResponse.json({ ok: true, user: data.user });
}
