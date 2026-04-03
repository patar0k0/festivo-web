import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type DiscoverySourceCreatePayload = {
  name?: unknown;
  base_url?: unknown;
  type?: unknown;
  source_type?: unknown;
  priority?: unknown;
  max_links_per_run?: unknown;
};

function normalizeHttpUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as DiscoverySourceCreatePayload;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const baseUrlRaw = typeof body.base_url === "string" ? body.base_url : "";
  const base_url = normalizeHttpUrl(baseUrlRaw);
  if (!base_url) {
    return NextResponse.json({ error: "base_url must be a valid http(s) URL" }, { status: 400 });
  }

  const typeRaw =
    typeof body.type === "string" && body.type.trim()
      ? body.type.trim()
      : typeof body.source_type === "string" && body.source_type.trim()
        ? body.source_type.trim()
        : "municipality_site";

  let priority = 100;
  if (body.priority !== undefined && body.priority !== null && body.priority !== "") {
    if (typeof body.priority !== "number" || !Number.isFinite(body.priority)) {
      return NextResponse.json({ error: "priority must be a number" }, { status: 400 });
    }
    priority = body.priority;
  }

  let max_links_per_run = 20;
  if (body.max_links_per_run !== undefined && body.max_links_per_run !== null && body.max_links_per_run !== "") {
    if (
      typeof body.max_links_per_run !== "number" ||
      !Number.isInteger(body.max_links_per_run) ||
      body.max_links_per_run < 1
    ) {
      return NextResponse.json({ error: "max_links_per_run must be a positive integer" }, { status: 400 });
    }
    max_links_per_run = body.max_links_per_run;
  }

  const insertPayload = {
    name,
    base_url,
    source_type: typeRaw,
    priority,
    max_links_per_run,
    is_active: true,
  };

  const { data, error } = await ctx.supabase.from("discovery_sources").insert(insertPayload).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const id = data?.id != null ? String(data.id) : "";

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "discovery_source.created",
      entity_type: "discovery_source",
      entity_id: id,
      route: "/admin/api/discovery-sources",
      method: "POST",
      details: {
        name,
        source_type: typeRaw,
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] discovery_source.created failed", { message });
  }

  return NextResponse.json({ ok: true, id });
}
