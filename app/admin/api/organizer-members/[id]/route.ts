import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

const ORG_ROLES = new Set(["owner", "admin", "editor", "viewer"]);

type Body = {
  role?: string;
};

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role.trim() : "";
  if (!ORG_ROLES.has(role)) {
    return NextResponse.json({ error: "Невалидна роля в организатора." }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/organizer-members/[id]] PATCH init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const { data: row, error: fetchErr } = await adminClient
      .from("organizer_members")
      .select("id, organizer_id, user_id, role, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.status !== "active" && row.status !== "pending") {
      return NextResponse.json({ error: "Само активни или чакащи членове могат да се редактират." }, { status: 400 });
    }

    if (row.role === "owner" && role !== "owner") {
      const orgId = row.organizer_id as string;
      const { data: owners, error: ownErr } = await adminClient
        .from("organizer_members")
        .select("user_id")
        .eq("organizer_id", orgId)
        .eq("role", "owner")
        .eq("status", "active");

      if (ownErr) {
        throw new Error(ownErr.message);
      }
      const ownerIds = (owners ?? []).map((r) => r.user_id as string);
      if (ownerIds.length === 1 && ownerIds[0] === row.user_id) {
        return NextResponse.json(
          { error: "Единственият собственик не може да бъде понижен. Първо добавете друг собственик." },
          { status: 400 },
        );
      }
    }

    const { error: updErr } = await adminClient.from("organizer_members").update({ role }).eq("id", id);
    if (updErr) {
      console.error("[admin/api/organizer-members/[id]] update failed", { message: updErr.message, id });
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "organizer_member_role_set",
        entity_type: "organizer_member",
        entity_id: id,
        route: `/admin/api/organizer-members/${id}`,
        method: "PATCH",
        details: { role, organizer_id: row.organizer_id, user_id: row.user_id },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/organizer-members/[id]] PATCH failed", { message, id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/organizer-members/[id]] DELETE init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  try {
    const { data: row, error: fetchErr } = await adminClient
      .from("organizer_members")
      .select("id, organizer_id, user_id, role, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.role === "owner" && row.status === "active") {
      const orgId = row.organizer_id as string;
      const { data: owners, error: ownErr } = await adminClient
        .from("organizer_members")
        .select("user_id")
        .eq("organizer_id", orgId)
        .eq("role", "owner")
        .eq("status", "active");

      if (ownErr) {
        throw new Error(ownErr.message);
      }
      const ownerIds = (owners ?? []).map((r) => r.user_id as string);
      if (ownerIds.length === 1 && ownerIds[0] === row.user_id) {
        return NextResponse.json(
          { error: "Не може да се премахне единственият активен собственик." },
          { status: 400 },
        );
      }
    }

    const { error: updErr } = await adminClient.from("organizer_members").update({ status: "revoked" }).eq("id", id);
    if (updErr) {
      console.error("[admin/api/organizer-members/[id]] revoke failed", { message: updErr.message, id });
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "organizer_member_revoke",
        entity_type: "organizer_member",
        entity_id: id,
        route: `/admin/api/organizer-members/${id}`,
        method: "DELETE",
        details: { organizer_id: row.organizer_id, user_id: row.user_id },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/organizer-members/[id]] DELETE failed", { message, id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
