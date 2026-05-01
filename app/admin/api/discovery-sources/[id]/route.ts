import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_DISCOVERY_SOURCE_TYPES = new Set(["facebook_page", "municipality_site", "aggregator_site"]);

type DiscoverySourcePatchPayload = {
  is_active?: unknown;
  max_links_per_run?: unknown;
  priority?: unknown;
  manual_disabled?: unknown;
  manual_override?: unknown;
  name?: unknown;
  label?: unknown;
  base_url?: unknown;
  source_type?: unknown;
};

function hasOwn<T extends object>(obj: T, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
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

    if (hasOwn(body, "manual_disabled")) {
      if (typeof body.manual_disabled !== "boolean") {
        return NextResponse.json({ error: "manual_disabled must be a boolean" }, { status: 400 });
      }
      patch.manual_disabled = body.manual_disabled;
    }

    if (hasOwn(body, "manual_override")) {
      if (typeof body.manual_override !== "boolean") {
        return NextResponse.json({ error: "manual_override must be a boolean" }, { status: 400 });
      }
      patch.manual_override = body.manual_override;
    }

    if (hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      patch.name = body.name.trim();
    }

    if (hasOwn(body, "label")) {
      if (typeof body.label !== "string") {
        return NextResponse.json({ error: "label must be a string" }, { status: 400 });
      }
      const trimmedLabel = body.label.trim();
      const fallbackName = typeof patch.name === "string" ? patch.name : null;
      const nextLabel = trimmedLabel || fallbackName;
      if (!nextLabel) {
        return NextResponse.json({ error: "label cannot be empty" }, { status: 400 });
      }
      patch.label = nextLabel;
    }

    if (hasOwn(body, "base_url")) {
      if (typeof body.base_url !== "string") {
        return NextResponse.json({ error: "base_url must be a string" }, { status: 400 });
      }
      const normalized = normalizeHttpUrl(body.base_url);
      if (!normalized) {
        return NextResponse.json({ error: "base_url must be a valid http(s) URL" }, { status: 400 });
      }
      patch.base_url = normalized;
    }

    if (hasOwn(body, "source_type")) {
      if (typeof body.source_type !== "string" || !body.source_type.trim()) {
        return NextResponse.json({ error: "source_type must be a non-empty string" }, { status: 400 });
      }
      const st = body.source_type.trim();
      if (!ALLOWED_DISCOVERY_SOURCE_TYPES.has(st)) {
        return NextResponse.json({ error: "source_type is not allowed" }, { status: 400 });
      }
      patch.source_type = st;
    }

    if (patch.manual_disabled === true) {
      patch.manual_override = false;
    } else if (patch.manual_override === true) {
      patch.manual_disabled = false;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    let admin;
    try {
      admin = createSupabaseAdmin();
    } catch (adminClientError) {
      console.error("discovery PATCH admin client failed", adminClientError);
      return NextResponse.json({ error: "Discovery source update failed" }, { status: 500 });
    }

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
  } catch (error) {
    console.error("discovery PATCH crashed", error);
    return NextResponse.json({ error: "Discovery source update failed" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: rawId } = await params;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Invalid source id" }, { status: 400 });
    }

    let admin;
    try {
      admin = createSupabaseAdmin();
    } catch (adminClientError) {
      console.error("discovery DELETE admin client failed", adminClientError);
      return NextResponse.json({ error: "Discovery source delete failed" }, { status: 500 });
    }

    const { error } = await admin
      .from("discovery_sources")
      .update({
        is_active: false,
        manual_disabled: true,
        manual_override: false,
      })
      .eq("id", id);

    if (error) {
      console.error("discovery soft delete failed", error);
      return NextResponse.json({ error: error.message || "Failed to deactivate discovery source" }, { status: 500 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "discovery_source.soft_deleted",
        entity_type: "discovery_source",
        entity_id: id,
        route: "/admin/api/discovery-sources/[id]",
        method: "DELETE",
        details: {
          is_active: false,
          manual_disabled: true,
        },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[admin/audit] discovery_source.soft_deleted failed", { message });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("discovery DELETE crashed", error);
    return NextResponse.json({ error: "Discovery source delete failed" }, { status: 500 });
  }
}
