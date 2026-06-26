import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

export const dynamic = "force-dynamic";

export type AdminCityRow = {
  id: number;
  name_bg: string;
  slug: string;
  region: string | null;
  is_village: boolean | null;
};

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("cities").select("id,name_bg,slug,region,is_village");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cities = ((data ?? []) as AdminCityRow[]).sort((a, b) =>
    a.name_bg.localeCompare(b.name_bg, "bg-BG"),
  );

  return NextResponse.json({ cities });
}

type PatchCityBody = {
  id?: unknown;
  is_village?: unknown;
  region?: unknown;
};

function normalizeRegionInput(value: unknown): { ok: true; region: string | null } | { ok: false } {
  if (value === null) return { ok: true, region: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  return { ok: true, region: trimmed === "" ? null : trimmed };
}

export async function PATCH(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as PatchCityBody | null;
  const id = typeof body?.id === "number" && Number.isFinite(body.id) ? body.id : null;
  if (id === null) {
    return NextResponse.json({ error: "id трябва да е число" }, { status: 400 });
  }

  const hasIsVillage = body?.is_village !== undefined;
  const hasRegion = body?.region !== undefined;
  if (!hasIsVillage && !hasRegion) {
    return NextResponse.json({ error: "Няма какво да се обнови" }, { status: 400 });
  }

  let is_village: boolean | null | undefined;
  if (hasIsVillage) {
    const v = body?.is_village;
    if (v !== true && v !== false && v !== null) {
      return NextResponse.json(
        { error: "is_village трябва да е true, false или null" },
        { status: 400 },
      );
    }
    is_village = v;
  }

  let region: string | null | undefined;
  if (hasRegion) {
    const normalized = normalizeRegionInput(body?.region);
    if (!normalized.ok) {
      return NextResponse.json({ error: "region трябва да е текст или null" }, { status: 400 });
    }
    region = normalized.region;
  }

  const admin = createSupabaseAdmin();

  const { data: existing, error: readError } = await admin
    .from("cities")
    .select("id,is_village,region")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Населеното място не е намерено" }, { status: 404 });
  }

  const updatePayload: { is_village?: boolean | null; region?: string | null } = {};
  if (hasIsVillage) updatePayload.is_village = is_village;
  if (hasRegion) updatePayload.region = region;

  const { error: updateError } = await admin.from("cities").update(updatePayload).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const details: Record<string, { from: unknown; to: unknown }> = {};
  if (hasIsVillage) details.is_village = { from: existing.is_village, to: is_village };
  if (hasRegion) details.region = { from: existing.region, to: region };

  await logAdminAction({
    actor_user_id: ctx.user.id,
    action: "update_city",
    entity_type: "city",
    entity_id: String(id),
    route: "/admin/api/cities",
    method: "PATCH",
    details,
  });

  return NextResponse.json({ ok: true });
}
