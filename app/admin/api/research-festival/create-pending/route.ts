import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { insertResearchIngestJob } from "@/lib/admin/ingest/insertResearchIngestJob";
import type { ResearchEnqueueBody } from "@/lib/admin/ingest/researchPendingRowFromRequest";

/**
 * @deprecated Prefer POST /admin/api/ingest-jobs with source_type research (same JSON body).
 * Creates an ingest_jobs row (source_type=research); worker inserts pending_festivals.
 */
export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ResearchEnqueueBody | null;
  const outcome = await insertResearchIngestJob(ctx.supabase, body);

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "ingest_job.created",
      entity_type: "ingest_job",
      entity_id: outcome.jobId,
      route: "/admin/api/research-festival/create-pending",
      method: "POST",
      details: { source_type: "research", via: "research_create_pending_alias" },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] research enqueue failed", { message });
  }

  return NextResponse.json({
    ok: true,
    id: outcome.jobId,
    job_id: outcome.jobId,
    status: outcome.status,
  });
}
