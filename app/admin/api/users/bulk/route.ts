import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminUserDetail, isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  assertCanApplyDestructiveUserAction,
  assertNotSoleOrganizerOwner,
  setUserSoftDeleted,
} from "@/lib/admin/adminUserAccount";
import { sanitizeDeletedReason } from "@/lib/admin/sanitizeDeletedReason";
import { getUserAppRole, persistUserAppRole, assertCanSetAppRole } from "@/lib/admin/adminUserRole";
import { logUserSecurityAudit } from "@/lib/admin/userSecurityAuditLog";
import { isAppRoleValue, type AppRole } from "@/lib/admin/appRoles";
import { consumeAdminBulkUserOperationTokens } from "@/lib/rateLimit";
import { adminSyncUserBannedUntil } from "@/lib/admin/syncUserBannedUntil";
import { invalidateCachedUserGate } from "@/lib/middlewareUserGateCache";

const BAN_DURATION = "87600h";
const MAX_IDS = 50;

type Body = {
  action?: string;
  user_ids?: string[];
  role?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  const rawIds = Array.isArray(body.user_ids) ? body.user_ids : [];
  const userIds = [...new Set(rawIds.map((x) => String(x).trim()).filter(isAuthUserId))].sort((a, b) =>
    a.localeCompare(b),
  );

  if (userIds.length > MAX_IDS) {
    return NextResponse.json({ error: `Максимум ${MAX_IDS} потребители на заявка.` }, { status: 400 });
  }

  if (userIds.length === 0) {
    return NextResponse.json({ error: "Подайте поне един валиден user id." }, { status: 400 });
  }

  if (action === "ban" || action === "soft_delete") {
    const bulkOps = await consumeAdminBulkUserOperationTokens(request, ctx.user.id, userIds.length);
    if (bulkOps.limited) {
      return NextResponse.json(
        { error: "Твърде много операции към потребители за кратко време. Опитайте по-късно." },
        {
          status: 429,
          headers: { "Retry-After": String(bulkOps.resetSeconds) },
        },
      );
    }
  }

  let reason: string | null = null;
  const r = body.reason;
  if (typeof r === "string" && r.trim()) {
    reason = sanitizeDeletedReason(r);
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/bulk] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  const success: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  const pushFail = (id: string, err: unknown) => {
    failed.push({ id, error: err instanceof Error ? err.message : "error" });
  };

  try {
    if (action === "ban") {
      for (const id of userIds) {
        try {
          if (id === ctx.user.id) {
            pushFail(id, "Не можете да приложите това действие към собствения си акаунт.");
            continue;
          }
          const detail = await fetchAdminUserDetail(adminClient, id);
          if (!detail) {
            pushFail(id, "Not found");
            continue;
          }
          const appRole = await getUserAppRole(adminClient, id);
          await assertCanApplyDestructiveUserAction(adminClient, { actorUserId: ctx.user.id, targetUserId: id }, appRole);
          const { data: banData, error } = await adminClient.auth.admin.updateUserById(id, {
            ban_duration: BAN_DURATION,
          });
          if (error) {
            pushFail(id, error.message);
            continue;
          }
          try {
            await adminSyncUserBannedUntil(adminClient, id, banData.user.banned_until ?? null);
          } catch (syncErr) {
            const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
            const { error: rollbackErr } = await adminClient.auth.admin.updateUserById(id, { ban_duration: "none" });
            if (rollbackErr) {
              console.error("[admin/api/users/bulk] ban rollback failed after DB sync error", {
                id,
                message: rollbackErr.message,
              });
              const { error: flagErr } = await adminClient.from("users").update({ ban_sync_error: true }).eq("id", id);
              if (flagErr) {
                console.error("[admin/api/users/bulk] ban_sync_error flag failed", { id, message: flagErr.message });
              }
              await logAdminAction({
                actor_user_id: ctx.user.id,
                action: "ban_sync_rollback_failed",
                entity_type: "user",
                entity_id: id,
                route: "/admin/api/users/bulk",
                method: "POST",
                details: { sync_error: syncMsg, rollback_error: rollbackErr.message, bulk: true },
              });
              pushFail(
                id,
                new Error(
                  "Критична грешка: несъгласувано състояние на бана след неуспешен отказ в Auth.",
                ),
              );
              continue;
            }
            pushFail(id, new Error(syncMsg));
            continue;
          }
          invalidateCachedUserGate(id);
          await logUserSecurityAudit({
            actorUserId: ctx.user.id,
            targetUserId: id,
            action: "user_ban",
            route: "/admin/api/users/bulk",
            method: "POST",
            metadata: { email: detail.email, bulk: true },
          });
          success.push(id);
        } catch (e) {
          pushFail(id, e);
        }
      }
    } else if (action === "soft_delete") {
      for (const id of userIds) {
        try {
          if (id === ctx.user.id) {
            pushFail(id, "Не можете да приложите това действие към собствения си акаунт.");
            continue;
          }
          const detail = await fetchAdminUserDetail(adminClient, id);
          if (!detail) {
            pushFail(id, "Not found");
            continue;
          }
          if (detail.deleted_at) {
            pushFail(id, "Вече деактивиран.");
            continue;
          }
          const appRole = await getUserAppRole(adminClient, id);
          await assertCanApplyDestructiveUserAction(adminClient, { actorUserId: ctx.user.id, targetUserId: id }, appRole);
          await setUserSoftDeleted(adminClient, id, true, { actorUserId: ctx.user.id, reason });
          invalidateCachedUserGate(id);
          await logUserSecurityAudit({
            actorUserId: ctx.user.id,
            targetUserId: id,
            action: "user_soft_delete",
            route: "/admin/api/users/bulk",
            method: "POST",
            metadata: { email: detail.email, reason: reason ?? undefined, bulk: true },
          });
          success.push(id);
        } catch (e) {
          pushFail(id, e);
        }
      }
    } else if (action === "set_role") {
      const rawRole = body.role;
      if (rawRole == null || !isAppRoleValue(rawRole)) {
        return NextResponse.json({ error: "За set_role подайте валидна role." }, { status: 400 });
      }
      const nextRole: AppRole = rawRole;
      for (const id of userIds) {
        try {
          if (id === ctx.user.id) {
            pushFail(id, "Не можете да приложите това действие към собствения си акаунт.");
            continue;
          }
          await assertNotSoleOrganizerOwner(adminClient, id);
          const prevRole = await getUserAppRole(adminClient, id);
          await assertCanSetAppRole(adminClient, ctx.user.id, id, nextRole);
          await persistUserAppRole(adminClient, id, nextRole);
          await logUserSecurityAudit({
            actorUserId: ctx.user.id,
            targetUserId: id,
            action: "user_role_change",
            route: "/admin/api/users/bulk",
            method: "POST",
            metadata: { from: prevRole, to: nextRole, bulk: true },
          });
          success.push(id);
        } catch (e) {
          pushFail(id, e);
        }
      }
    } else {
      return NextResponse.json({ error: "action: ban | soft_delete | set_role" }, { status: 400 });
    }

    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "users_bulk",
      entity_type: "user",
      entity_id: null,
      route: "/admin/api/users/bulk",
      method: "POST",
      details: {
        action,
        count: userIds.length,
        ok: success.length,
        failed: failed.length,
      },
    });

    return NextResponse.json({ ok: true, success, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/bulk] failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
