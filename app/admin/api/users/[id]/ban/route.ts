import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isAuthUserId } from "@/lib/admin/adminUserDetail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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

  return NextResponse.json({ ok: true, user: data.user });
}
