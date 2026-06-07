import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RunBody = { mode?: unknown; source_id?: unknown };

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as RunBody;
  const mode = body.mode === "single_source" ? "single_source" : "full";

  let source_id: number | null = null;
  if (mode === "single_source") {
    const n = Number(body.source_id);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "source_id is required for single_source mode" }, { status: 400 });
    }
    source_id = n;
  }

  // Dedupe: if a pending request for the same target exists, return it.
  const baseQuery = ctx.supabase
    .from("discovery_run_requests")
    .select("id, status, requested_at")
    .eq("status", "requested")
    .eq("mode", mode);
  const existing =
    source_id === null
      ? await baseQuery.is("source_id", null).maybeSingle()
      : await baseQuery.eq("source_id", source_id).maybeSingle();

  if (existing.data) {
    return NextResponse.json({ ok: true, id: existing.data.id, deduped: true });
  }

  const { data, error } = await ctx.supabase
    .from("discovery_run_requests")
    .insert({ status: "requested", mode, source_id, requested_by: ctx.user.id })
    .select("id")
    .single();

  if (error) {
    // Concurrent insert hit the partial unique index → treat as dedupe.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "discovery.run_requested",
      entity_type: "discovery_run_request",
      entity_id: String(data.id),
      route: "/admin/api/discovery/run",
      method: "POST",
      details: { mode, source_id },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] discovery.run_requested failed", { message });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
