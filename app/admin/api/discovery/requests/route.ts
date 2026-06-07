import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await ctx.supabase
    .from("discovery_run_requests")
    .select("id, status, mode, source_id, requested_at, claimed_at, finished_at, run_id, error")
    .order("requested_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, requests: data ?? [] });
}
