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
};

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

  const is_village = body?.is_village;
  if (is_village !== true && is_village !== false && is_village !== null) {
    return NextResponse.json(
      { error: "is_village трябва да е true, false или null" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();

  const { data: existing, error: readError } = await admin
    .from("cities")
    .select("id,is_village")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Населеното място не е намерено" }, { status: 404 });
  }

  const { error: updateError } = await admin.from("cities").update({ is_village }).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAdminAction({
    actor_user_id: ctx.user.id,
    action: "update_is_village",
    entity_type: "city",
    entity_id: String(id),
    route: "/admin/api/cities",
    method: "PATCH",
    details: { from: existing.is_village, to: is_village },
  });

  return NextResponse.json({ ok: true });
}
