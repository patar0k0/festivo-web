import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(_request: Request, context: RouteContext) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = context.params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing job id." }, { status: 400 });
  }

  const { data: current, error: currentError } = await ctx.supabase
    .from("ingest_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json({ error: "Ingest job not found." }, { status: 404 });
  }

  const sourceUrl = typeof current.source_url === "string" ? current.source_url : "";
  if (!sourceUrl) {
    return NextResponse.json({ error: "Retry requires a job with a valid source URL." }, { status: 409 });
  }

  const { error: deletePendingError } = await ctx.supabase
    .from("pending_festivals")
    .delete()
    .eq("source_url", sourceUrl);

  if (deletePendingError) {
    return NextResponse.json({ error: deletePendingError.message }, { status: 500 });
  }

  const resetPatch: Record<string, unknown> = {
    status: "queued",
    started_at: null,
    finished_at: null,
  };

  if ("error" in current) {
    resetPatch.error = null;
  }
  if ("error_message" in current) {
    resetPatch.error_message = null;
  }
  if ("attempt_count" in current) {
    resetPatch.attempt_count = 0;
  }
  if ("lock_token" in current) {
    resetPatch.lock_token = null;
  }
  if ("locked_at" in current) {
    resetPatch.locked_at = null;
  }
  if ("lock_expires_at" in current) {
    resetPatch.lock_expires_at = null;
  }
  if ("next_retry_at" in current) {
    resetPatch.next_retry_at = null;
  }
  if ("pending_festival_id" in current) {
    resetPatch.pending_festival_id = null;
  }
  if ("fb_browser_context" in current) {
    resetPatch.fb_browser_context = null;
  }

  const { error: updateError } = await ctx.supabase
    .from("ingest_jobs")
    .update(resetPatch)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath("/admin/ingest");
  revalidatePath("/admin/pending-festivals");

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "ingest_job.retried",
      entity_type: "ingest_job",
      entity_id: id,
      route: "/admin/api/ingest-jobs/[id]",
      method: "PATCH",
      details: {},
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] ingest_job.retried failed", { message });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = context.params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing job id." }, { status: 400 });
  }

  const { error } = await ctx.supabase.from("ingest_jobs").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "ingest_job.deleted",
      entity_type: "ingest_job",
      entity_id: id,
      route: "/admin/api/ingest-jobs/[id]",
      method: "DELETE",
      details: {},
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] ingest_job.deleted failed", { message });
  }

  return NextResponse.json({ ok: true });
}
