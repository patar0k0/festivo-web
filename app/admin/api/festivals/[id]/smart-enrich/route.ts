import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runSmartResearchPipeline } from "@/lib/admin/research/smart-pipeline";
import { computeSmartResearchPatch } from "@/lib/admin/research/computeSmartResearchPatch";

export const dynamic = "force-dynamic";

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

async function loadFestivalRow(admin: ReturnType<typeof createSupabaseAdmin>, festivalId: string) {
  const { data, error } = await admin
    .from("festivals")
    .select(
      "id,title,city,start_date,description,website_url,ticket_url,location_name,address,is_free,category,start_time,end_time,tags",
    )
    .eq("id", festivalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("festival_enrichment_proposals")
    .select("id,status,created_at")
    .eq("target_festival_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ageMs = data ? Date.now() - new Date(data.created_at).getTime() : null;
  return NextResponse.json({
    proposal: data ?? null,
    rateLimited: ageMs !== null && ageMs < RATE_LIMIT_MS,
    retryAfterSeconds: ageMs !== null && ageMs < RATE_LIMIT_MS ? Math.ceil((RATE_LIMIT_MS - ageMs) / 1000) : 0,
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createSupabaseAdmin();

  const { data: recent, error: recentErr } = await admin
    .from("festival_enrichment_proposals")
    .select("created_at")
    .eq("target_festival_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentErr) return NextResponse.json({ error: recentErr.message }, { status: 500 });

  if (recent) {
    const ageMs = Date.now() - new Date(recent.created_at).getTime();
    if (ageMs < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: Math.ceil((RATE_LIMIT_MS - ageMs) / 1000) },
        { status: 429 },
      );
    }
  }

  let festival: Awaited<ReturnType<typeof loadFestivalRow>>;
  try {
    festival = await loadFestivalRow(admin, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "festival lookup failed" }, { status: 500 });
  }
  if (!festival) return NextResponse.json({ error: "Festival not found" }, { status: 404 });

  const { count: programDaysCount, error: daysErr } = await admin
    .from("festival_days")
    .select("id", { count: "exact", head: true })
    .eq("festival_id", id);
  if (daysErr) return NextResponse.json({ error: daysErr.message }, { status: 500 });

  const year = festival.start_date ? festival.start_date.slice(0, 4) : "";
  const query = [festival.title, festival.city, year].filter(Boolean).join(" ").trim();

  let pipelineResult;
  try {
    pipelineResult = await runSmartResearchPipeline(query);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "smart research pipeline failed" },
      { status: 502 },
    );
  }

  const patch = computeSmartResearchPatch(
    pipelineResult.fields,
    {
      description: festival.description,
      website_url: festival.website_url,
      ticket_url: festival.ticket_url,
      location_name: festival.location_name,
      address: festival.address,
      is_free: festival.is_free,
      category: festival.category,
      start_time: festival.start_time,
      end_time: festival.end_time,
      tags: festival.tags,
    },
    (programDaysCount ?? 0) > 0,
  );

  if (!patch) {
    return NextResponse.json({ ok: true, kind: "nothing_to_patch", warnings: pipelineResult.warnings });
  }

  const { data: inserted, error: insertErr } = await admin
    .from("festival_enrichment_proposals")
    .insert({ target_festival_id: id, patch_json: patch, poster_ingest_job_id: null })
    .select("id")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, kind: "proposal_created", proposalId: inserted.id, fields: Object.keys(patch) });
}
