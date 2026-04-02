import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

function normalizeFacebookEventUrl(input: string) {
  const trimmed = input.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Invalid URL." } as const;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "URL must start with http or https." } as const;
  }

  if (!parsed.hostname.toLowerCase().includes("facebook.com") || !parsed.pathname.toLowerCase().includes("/events/")) {
    return { error: "URL must contain facebook.com/events/." } as const;
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return { value: parsed.toString().replace(/\/$/, "") } as const;
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { source_url?: unknown } | null;
  const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";

  const normalized = normalizeFacebookEventUrl(sourceUrl);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("ingest_jobs")
    .insert({
      source_url: normalized.value,
      source_type: "facebook_event",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already queued" }, { status: 409 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "ingest_job.created",
      entity_type: "ingest_job",
      entity_id: String(data.id),
      route: "/admin/api/ingest-jobs",
      method: "POST",
      details: {
        source_type: "facebook_event",
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] ingest_job.created failed", { message });
  }

  return NextResponse.json({ ok: true, id: String(data.id) });
}
