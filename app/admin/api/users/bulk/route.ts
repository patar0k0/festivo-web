import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminUserDetail, isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  assertCanApplyDestructiveUserAction,
  invalidateAuthSessions,
  setUserSoftDeleted,
} from "@/lib/admin/adminUserAccount";
import { getUserAppRole, persistUserAppRole, assertCanSetAppRole } from "@/lib/admin/adminUserRole";
import { isAppRoleValue, type AppRole } from "@/lib/admin/appRoles";

const BAN_DURATION = "87600h";
const MAX_IDS = 80;

type Body = {
  action?: string;
  user_ids?: string[];
  role?: string;
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
  const userIds = [...new Set(rawIds.map((x) => String(x).trim()).filter(isAuthUserId))].slice(0, MAX_IDS);

  if (userIds.length === 0) {
    return NextResponse.json({ error: "Подайте поне един валиден user id." }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/bulk] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  const errors: Record<string, string> = {};
  let ok = 0;

  try {
    if (action === "ban") {
      for (const id of userIds) {
        try {
          const { error } = await adminClient.auth.admin.updateUserById(id, { ban_duration: BAN_DURATION });
          if (error) {
            errors[id] = error.message;
            continue;
          }
          ok += 1;
        } catch (e) {
          errors[id] = e instanceof Error ? e.message : "error";
        }
      }
    } else if (action === "soft_delete") {
      for (const id of userIds) {
        try {
          if (id === ctx.user.id) {
            errors[id] = "Не можете да приложите това действие към собствения си акаунт.";
            continue;
          }
          const detail = await fetchAdminUserDetail(adminClient, id);
          if (!detail) {
            errors[id] = "Not found";
            continue;
          }
          if (detail.deleted_at) {
            errors[id] = "Вече деактивиран.";
            continue;
          }
          const appRole = await getUserAppRole(adminClient, id);
          await assertCanApplyDestructiveUserAction(adminClient, { actorUserId: ctx.user.id, targetUserId: id }, appRole);
          await setUserSoftDeleted(adminClient, id, true);
          await invalidateAuthSessions(adminClient, id);
          ok += 1;
        } catch (e) {
          errors[id] = e instanceof Error ? e.message : "error";
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
          await assertCanSetAppRole(adminClient, ctx.user.id, id, nextRole);
          await persistUserAppRole(adminClient, id, nextRole);
          ok += 1;
        } catch (e) {
          errors[id] = e instanceof Error ? e.message : "error";
        }
      }
    } else {
      return NextResponse.json({ error: "action: ban | soft_delete | set_role" }, { status: 400 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "users_bulk",
        entity_type: "user",
        entity_id: null,
        route: "/admin/api/users/bulk",
        method: "POST",
        details: { action, count: userIds.length, ok, failed: Object.keys(errors).length },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true, processed: ok, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/bulk] failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
