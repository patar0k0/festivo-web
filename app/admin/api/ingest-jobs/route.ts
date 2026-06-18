import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { insertDiscoveryIngestJob } from "@/lib/admin/ingest/insertDiscoveryIngestJob";
import { insertResearchIngestJob } from "@/lib/admin/ingest/insertResearchIngestJob";
import { enqueueFacebookEventIngest } from "@/lib/admin/ingest/enqueueFacebookEventIngest";
import type { ResearchEnqueueBody } from "@/lib/admin/ingest/researchPendingRowFromRequest";

type IngestJobsPostBody = ResearchEnqueueBody & {
  source_type?: unknown;
  source_url?: unknown;
  discovered_link_id?: unknown;
};

function isResearchBody(body: IngestJobsPostBody | null): body is ResearchEnqueueBody & { source_type?: string } {
  if (!body || typeof body !== "object") return false;
  if (body.source_type === "research") return true;
  if ("ai_result" in body && body.ai_result) return true;
  if ("result" in body && body.result) return true;
  return false;
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as IngestJobsPostBody | null;

  if (isResearchBody(body)) {
    const researchBody: ResearchEnqueueBody = {
      ai_result: body.ai_result,
      result: body.result,
      final_values: body.final_values,
    };
    const outcome = await insertResearchIngestJob(ctx.supabase, researchBody);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "ingest_job.created",
        entity_type: "ingest_job",
        entity_id: outcome.jobId,
        route: "/admin/api/ingest-jobs",
        method: "POST",
        details: { source_type: "research" },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[admin/audit] ingest_job.created failed", { message });
    }

    return NextResponse.json({ ok: true, id: outcome.jobId, job_id: outcome.jobId, status: outcome.status });
  }

  if (body && body.source_type === "discovery") {
    const sourceUrl = typeof body.source_url === "string" ? body.source_url : "";
    if (!sourceUrl.trim()) {
      return NextResponse.json({ error: "source_url is required for discovery jobs." }, { status: 400 });
    }
    const linkId =
      typeof body.discovered_link_id === "string" && body.discovered_link_id.trim()
        ? body.discovered_link_id.trim()
        : null;
    const outcome = await insertDiscoveryIngestJob(ctx.supabase, sourceUrl, { discovered_link_id: linkId });
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "ingest_job.created",
        entity_type: "ingest_job",
        entity_id: outcome.jobId,
        route: "/admin/api/ingest-jobs",
        method: "POST",
        details: { source_type: "discovery" },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[admin/audit] ingest_job.created failed", { message });
    }

    return NextResponse.json({ ok: true, id: outcome.jobId, job_id: outcome.jobId, status: outcome.status });
  }

  const sourceUrl = body && typeof body.source_url === "string" ? body.source_url : "";

  const result = await enqueueFacebookEventIngest(ctx.supabase, sourceUrl, "ingest");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.kind === "already_queued") {
    return NextResponse.json({ error: "Already queued" }, { status: 409 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "ingest_job.created",
      entity_type: "ingest_job",
      entity_id: result.jobId,
      route: "/admin/api/ingest-jobs",
      method: "POST",
      details: { source_type: "facebook_event" },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] ingest_job.created failed", { message });
  }

  return NextResponse.json({ ok: true, id: result.jobId, job_id: result.jobId, status: result.status });
}
