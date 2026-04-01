import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  action?: string;
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

  const action = body.action;
  if (action !== "grant_admin" && action !== "revoke_admin") {
    return NextResponse.json({ error: "Expected action: grant_admin | revoke_admin" }, { status: 400 });
  }

  if (action === "revoke_admin" && id === ctx.user.id) {
    return NextResponse.json({ error: "Не можете да премахнете собствената си администраторска роля." }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users/[id]/role] Admin client init failed", { message });
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 500 });
  }

  if (action === "grant_admin") {
    const { data: existing } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("user_id", id)
      .eq("role", "admin")
      .maybeSingle();
    if (!existing) {
      const { error } = await adminClient.from("user_roles").insert({ user_id: id, role: "admin" });
      if (error) {
        console.error("[admin/api/users/[id]/role] insert failed", { message: error.message, id });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await adminClient.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
  if (error) {
    console.error("[admin/api/users/[id]/role] delete failed", { message: error.message, id });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
