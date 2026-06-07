import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { DISCOVERY_CONFIG_DEFAULTS, validateDiscoveryConfigPatch } from "@/lib/admin/discovery/config";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await ctx.supabase
    .from("discovery_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: data ?? { id: 1, ...DISCOVERY_CONFIG_DEFAULTS } });
}

export async function PATCH(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = validateDiscoveryConfigPatch(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const patch = { ...result.value, updated_at: new Date().toISOString(), updated_by: ctx.user.id };
  const { data, error } = await ctx.supabase
    .from("discovery_config")
    .upsert({ id: 1, ...patch }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "discovery.config_updated",
      entity_type: "discovery_config",
      entity_id: "1",
      route: "/admin/api/discovery/config",
      method: "PATCH",
      details: { changed_fields: Object.keys(result.value) },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] discovery.config_updated failed", { message });
  }

  return NextResponse.json({ ok: true, config: data });
}
