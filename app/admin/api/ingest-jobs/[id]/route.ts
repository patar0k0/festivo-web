import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

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
    .select("id,status,source_url")
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json({ error: "Ingest job not found." }, { status: 404 });
  }

  if (current.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be retried." }, { status: 409 });
  }

  const { error: deletePendingError } = await ctx.supabase
    .from("pending_festivals")
    .delete()
    .eq("source_url", current.source_url);

  if (deletePendingError) {
    return NextResponse.json({ error: deletePendingError.message }, { status: 500 });
  }

  const { error: updateError } = await ctx.supabase
    .from("ingest_jobs")
    .update({
      status: "queued",
      attempt_count: 0,
      started_at: null,
      finished_at: null,
      error: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
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

  return NextResponse.json({ ok: true });
}
