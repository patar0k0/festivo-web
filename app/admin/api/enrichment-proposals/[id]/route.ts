import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminContext } from "@/lib/admin/isAdmin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("festival_enrichment_proposals")
    .select("*,festivals(id,title,start_date,description,website_url,ticket_url,location_name,address,is_free,category)")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal: data });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action as "approve" | "reject" | undefined;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: proposal, error: fetchErr } = await supabase
    .from("festival_enrichment_proposals")
    .select("id,status,patch_json,target_festival_id")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "pending") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  if (action === "approve") {
    const { error: updateFestivalErr } = await supabase
      .from("festivals")
      .update(proposal.patch_json as Record<string, unknown>)
      .eq("id", proposal.target_festival_id);
    if (updateFestivalErr) return NextResponse.json({ error: updateFestivalErr.message }, { status: 500 });
  }

  const { error: proposalErr } = await supabase
    .from("festival_enrichment_proposals")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (proposalErr) return NextResponse.json({ error: proposalErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
