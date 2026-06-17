import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit-log";
import { buildResearchPendingRowFromRequest } from "@/lib/admin/ingest/researchPendingRowFromRequest";
import { getAdminContext } from "@/lib/admin/isAdmin";
import type { PerplexityFestivalResearchResult } from "@/lib/research/perplexity";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        data?: unknown;
        confidence_score?: unknown;
        needs_review?: unknown;
      }
    | null;

  const data = body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "data object is required" }, { status: 400 });
  }

  const ai_result = data as PerplexityFestivalResearchResult;

  const built = await buildResearchPendingRowFromRequest({ ai_result });
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  const insertRow: Record<string, unknown> = { ...built.row };

  const evRaw = insertRow.evidence_json;
  const ev =
    evRaw && typeof evRaw === "object" && !Array.isArray(evRaw) ? { ...(evRaw as Record<string, unknown>) } : {};
  const urlList = Array.isArray(ev.source_urls) ? (ev.source_urls as unknown[]).filter((u) => typeof u === "string") : [];
  insertRow.evidence_json = {
    ...ev,
    sources: urlList,
  };

  const srcUrls = Array.isArray(ai_result.source_urls) ? ai_result.source_urls.filter((u) => typeof u === "string") : [];
  if (srcUrls.length >= 2) {
    insertRow.extraction_version = "research_admin_multi_merge_v1";
    insertRow.evidence_json = {
      ...(insertRow.evidence_json as Record<string, unknown>),
      admin_multi_url_merge: true,
    };
  }

  if (typeof body.confidence_score === "number" && Number.isFinite(body.confidence_score)) {
    insertRow.confidence_score = Math.max(0, Math.min(100, Math.round(body.confidence_score)));
  }

  if (typeof body.needs_review === "boolean") {
    insertRow.needs_review = Boolean(insertRow.needs_review) || body.needs_review;
  }

  insertRow.is_free = (insertRow.is_free as boolean | null | undefined) ?? false;
  insertRow.verification_status = "needs_review";

  const admin = createSupabaseAdmin();
  const { data: inserted, error } = await admin.from("pending_festivals").insert(insertRow).select("id").single();

  if (error) {
    // Duplicate source_url → find the existing pending festival and redirect to it
    if (error.code === "23505" && insertRow.source_url) {
      const { data: existing } = await admin
        .from("pending_festivals")
        .select("id")
        .eq("source_url", insertRow.source_url as string)
        .maybeSingle();
      if (existing?.id) {
        return NextResponse.json({ ok: true, id: String(existing.id), duplicate: true }, { status: 200 });
      }
    }
    console.error("[admin/pending-festivals/direct-create] insert", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!inserted?.id) {
    return NextResponse.json({ error: "Insert did not return id" }, { status: 500 });
  }

  const id = String(inserted.id);

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "pending_festival.created",
      entity_type: "pending_festival",
      entity_id: id,
      route: "/admin/api/pending-festivals/direct-create",
      method: "POST",
      details: { submission_source: "research", direct: true },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] pending_festival.created failed", { message });
  }

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
