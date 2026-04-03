import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type DiscoverySourcePatchPayload = {
  is_active?: unknown;
  max_links_per_run?: unknown;
  priority?: unknown;
};

function hasOwn<T extends object>(obj: T, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Invalid source id" }, { status: 400 });
  }

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

  if (hasOwn(body, "priority")) {
    if (typeof body.priority !== "number" || !Number.isFinite(body.priority)) {
      return NextResponse.json({ error: "priority must be a number" }, { status: 400 });
    }
    patch.priority = body.priority;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("discovery_sources").update(patch).eq("id", id);

  if (error) {
    console.error("discovery update failed", error);
    return NextResponse.json({ error: error.message || "Failed to update discovery source" }, { status: 500 });
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
