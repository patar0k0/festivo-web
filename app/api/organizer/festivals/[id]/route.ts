import { NextResponse } from "next/server";
import {
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import { getUserFestivalRole } from "@/lib/organizer/festivalAccess";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const session = await getPortalSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getPortalAdminClient();

  let role;
  try {
    role = await getUserFestivalRole(admin, session.user.id, festivalId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "role lookup failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  if (role === null) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: festival, error } = await admin
    .from("festivals")
    .select(
      "id,slug,title,description,description_short,category,city,start_date,end_date,occurrence_dates,location_name,address,latitude,longitude,hero_image,website_url,ticket_url,price_range,is_free,status,is_verified",
    )
    .eq("id", festivalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: `festival load failed: ${error.message}` },
      { status: 500 },
    );
  }
  if (!festival) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { data: organizers, error: orgErr } = await admin
    .from("festival_organizers")
    .select(
      "organizer_id, role, sort_order, organizers!inner(id,name,slug,logo_url)",
    )
    .eq("festival_id", festivalId)
    .order("role", { ascending: false }) // 'owner' before 'co_host'
    .order("sort_order", { ascending: true });

  if (orgErr) {
    return NextResponse.json(
      { ok: false, error: `organizers load failed: ${orgErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    role,
    festival,
    organizers: organizers ?? [],
  });
}

const EDITABLE_FIELDS = [
  "description",
  "description_short",
  "website_url",
  "ticket_url",
  "price_range",
  "is_free",
] as const satisfies readonly string[];

type EditableField = (typeof EDITABLE_FIELDS)[number];

function pickEditable(input: unknown): Partial<Record<EditableField, unknown>> {
  if (!input || typeof input !== "object") return {};
  const patch: Partial<Record<EditableField, unknown>> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in (input as Record<string, unknown>)) {
      patch[key] = (input as Record<string, unknown>)[key];
    }
  }
  return patch;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const session = await getPortalSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getPortalAdminClient();
  try {
    const role = await getUserFestivalRole(admin, session.user.id, festivalId);
    if (role !== "owner") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "role lookup failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const patch = pickEditable(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No editable fields in payload" },
      { status: 400 },
    );
  }

  const { error: updateError } = await admin
    .from("festivals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", festivalId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: `update failed: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
