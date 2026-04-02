import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validateNoUnknownKeys } from "@/lib/api/strictBody";
import { ORGANIZER_PATCH_ALLOWED_KEYS } from "@/lib/admin/patchAllowedKeys";
import { logAdminAction } from "@/lib/admin/audit-log";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

type OrganizerPatchPayload = {
  name?: string;
  slug?: string;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  email?: string | null;
  phone?: string | null;
  verified?: boolean;
  city_id?: number | null;
  plan?: "free" | "vip";
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  included_promotions_per_year?: number | null;
  organizer_rank?: number | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await ctx.supabase
    .from("organizers")
    .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,email,phone,verified,city_id,plan,plan_started_at,plan_expires_at,included_promotions_per_year,organizer_rank,claimed_events_count,created_at")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ row: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/organizers/[id]][PATCH] Admin client initialization failed", { message });
    return NextResponse.json({ error: "Organizer update is temporarily unavailable" }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as OrganizerPatchPayload & Record<string, unknown>;
  const strictValidation = validateNoUnknownKeys(body, ORGANIZER_PATCH_ALLOWED_KEYS);
  if (!strictValidation.ok) {
    return NextResponse.json(
      { error: `Unknown field(s): ${strictValidation.unknownKeys.join(", ")}` },
      { status: 400 },
    );
  }

  const patch = {
    name: normalizeText(body.name),
    slug: normalizeText(body.slug),
    description: normalizeText(body.description),
    logo_url: normalizeText(body.logo_url),
    website_url: normalizeText(body.website_url),
    facebook_url: normalizeText(body.facebook_url),
    instagram_url: normalizeText(body.instagram_url),
    email: normalizeText(body.email),
    phone: normalizeText(body.phone),
    verified: typeof body.verified === "boolean" ? body.verified : undefined,
    city_id: typeof body.city_id === "number" ? body.city_id : body.city_id === null ? null : undefined,
    plan: body.plan === "free" || body.plan === "vip" ? body.plan : undefined,
    plan_started_at: body.plan_started_at === null ? null : normalizeText(body.plan_started_at),
    plan_expires_at: body.plan_expires_at === null ? null : normalizeText(body.plan_expires_at),
    included_promotions_per_year:
      typeof body.included_promotions_per_year === "number"
        ? Math.trunc(body.included_promotions_per_year)
        : body.included_promotions_per_year === null
          ? null
          : undefined,
    organizer_rank:
      typeof body.organizer_rank === "number"
        ? Math.trunc(body.organizer_rank)
        : body.organizer_rank === null
          ? null
          : undefined,
  };

  const finalPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  if (Object.keys(finalPatch).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { id } = await params;

  const payloadKeys = Object.keys(finalPatch);
  console.info("[admin/api/organizers/[id]][PATCH] Update request received", {
    organizerId: id,
    payloadKeys,
  });

  const { data, error } = await adminClient
    .from("organizers")
    .update(finalPatch)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  console.info("[admin/api/organizers/[id]][PATCH] Update query completed", {
    organizerId: id,
    payloadKeys,
    rowReturned: Boolean(data),
    queryError: error ? error.message : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "organizer.updated",
      entity_type: "organizer",
      entity_id: data.id,
      route: "/admin/api/organizers/[id]",
      method: "PATCH",
      details: {
        changed_fields: payloadKeys,
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] organizer.updated failed", { message });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/organizers/[id]][DELETE] Admin client initialization failed", { message });
    return NextResponse.json({ error: "Organizer delete is temporarily unavailable" }, { status: 500 });
  }

  const { id } = await params;

  console.info("[admin/api/organizers/[id]][DELETE] Deactivate request received", { organizerId: id });

  const { data, error } = await adminClient
    .from("organizers")
    .update({ is_active: false })
    .eq("id", id)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  console.info("[admin/api/organizers/[id]][DELETE] Deactivate query completed", {
    organizerId: id,
    rowReturned: Boolean(data),
    queryError: error ? error.message : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "organizer.deleted",
      entity_type: "organizer",
      entity_id: data.id,
      route: "/admin/api/organizers/[id]",
      method: "DELETE",
      details: {},
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] organizer.deleted failed", { message });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
