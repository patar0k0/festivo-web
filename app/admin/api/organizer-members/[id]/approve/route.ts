import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: row, error: loadErr } = await admin
    .from("organizer_members")
    .select("id,organizer_id,user_id,role,status")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.status !== "pending") {
    return NextResponse.json({ error: "Заявката вече е обработена." }, { status: 409 });
  }

  if (row.role === "owner") {
    const { data: otherOwner, error: ownErr } = await admin
      .from("organizer_members")
      .select("id")
      .eq("organizer_id", row.organizer_id)
      .eq("role", "owner")
      .eq("status", "active")
      .neq("id", row.id)
      .limit(1)
      .maybeSingle();

    if (ownErr) {
      return NextResponse.json({ error: ownErr.message }, { status: 500 });
    }

    if (otherOwner) {
      return NextResponse.json({ error: "Вече има активен собственик за този организатор." }, { status: 409 });
    }
  }

  const { error: updErr } = await admin
    .from("organizer_members")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: ctx.user.id,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
