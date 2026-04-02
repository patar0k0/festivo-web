import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type DiscoverySourcePatchPayload = {
  is_active?: unknown;
  max_links_per_run?: unknown;
};

function hasOwn<T extends object>(obj: T, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as DiscoverySourcePatchPayload;

  const patch: Record<string, unknown> = {};

  if (hasOwn(body, "is_active")) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
    }
    patch.is_active = body.is_active;
  }

  if (hasOwn(body, "max_links_per_run")) {
    if (typeof body.max_links_per_run !== "number" || !Number.isInteger(body.max_links_per_run) || body.max_links_per_run < 1) {
      return NextResponse.json({ error: "max_links_per_run must be a positive integer" }, { status: 400 });
    }
    patch.max_links_per_run = body.max_links_per_run;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await ctx.supabase.from("discovery_sources").update(patch).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "discovery_source.updated",
      entity_type: "discovery_source",
      entity_id: id,
      route: "/admin/api/discovery-sources/[id]",
      method: "PATCH",
      details: {
        changed_fields: Object.keys(patch),
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] discovery_source.updated failed", { message });
  }

  return NextResponse.json({ ok: true });
}
