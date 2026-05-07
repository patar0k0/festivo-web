import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

type Body = { id?: string };

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("pending_festivals")
    .update({ last_reviewed_at: now })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("[admin/api/pending-festivals/review/skip] update failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json({ ok: true, touched: false });
  }

  return NextResponse.json({ ok: true, touched: true });
}
