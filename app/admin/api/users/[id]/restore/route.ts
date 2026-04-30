import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminUserDetail, isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logUserSecurityAudit } from "@/lib/admin/userSecurityAuditLog";
import { setUserSoftDeleted } from "@/lib/admin/adminUserAccount";
import {
  assertRestorableOrganizerMemberships,
  isActiveBanTs,
} from "@/lib/admin/restoreUserConsistency";
import { invalidateCachedUserGate } from "@/lib/middlewareUserGateCache";

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
    console.error("[admin/api/users/[id]/restore] admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const { data: authData, error: authErr } = await adminClient.auth.admin.getUserById(id);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Акаунтът липсва в Auth — възстановяването е невъзможно." }, { status: 400 });
    }
    if (isActiveBanTs(authData.user.banned_until)) {
      return NextResponse.json(
        { error: "Акаунтът е баннат. Премахнете бана преди възстановяване." },
        { status: 400 },
      );
    }

    const { data: usersRow, error: usersReadErr } = await adminClient
      .from("users")
      .select("banned_until")
      .eq("id", id)
      .maybeSingle();

    if (usersReadErr) {
      console.error("[admin/api/users/[id]/restore] users read", usersReadErr);
      return NextResponse.json({ error: "Неуспешна проверка на статуса." }, { status: 500 });
    }

    if (isActiveBanTs((usersRow as { banned_until?: string | null } | null)?.banned_until)) {
      return NextResponse.json(
        { error: "Акаунтът е маркиран като блокиран в базата. Синхронизирайте бана преди възстановяване." },
        { status: 400 },
      );
    }

    await assertRestorableOrganizerMemberships(adminClient, id);

    const detail = await fetchAdminUserDetail(adminClient, id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!detail.deleted_at) {
      return NextResponse.json({ error: "Потребителят не е деактивиран." }, { status: 400 });
    }

    const { data: roleRow, error: roleReadErr } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();

    if (roleReadErr) {
      console.error("[admin/api/users/[id]/restore] user_roles read", roleReadErr);
      return NextResponse.json({ error: "Неуспешна проверка на ролята." }, { status: 500 });
    }

    if (!roleRow) {
      const { error: insErr } = await adminClient.from("user_roles").insert({ user_id: id, role: "user" });
      if (insErr) {
        console.error("[admin/api/users/[id]/restore] user_roles insert", insErr);
        return NextResponse.json({ error: "Неуспешно създаване на роля преди възстановяване." }, { status: 500 });
      }
    }

    await setUserSoftDeleted(adminClient, id, false);
    invalidateCachedUserGate(id);

    await logUserSecurityAudit({
      actorUserId: ctx.user.id,
      targetUserId: id,
      action: "user_restore",
      route: `/admin/api/users/${id}/restore`,
      method: "POST",
      metadata: { email: detail.email },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users/[id]/restore] failed", { message, id });
    const status = message.includes("Невалид") || message.includes("липсващ") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
