import { NextResponse } from "next/server";
import { assertCanEditOrganizer } from "@/lib/organizer/permissions";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";

type OrganizerPatchBody = {
  name?: unknown;
  description?: unknown;
  logo_url?: unknown;
  website_url?: unknown;
  facebook_url?: unknown;
  instagram_url?: unknown;
  email?: unknown;
  phone?: unknown;
  city_id?: unknown;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalCityId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as OrganizerPatchBody;

  try {
    await assertCanEditOrganizer(admin, session.user.id, id);
  } catch (error) {
    if (error instanceof Error && error.name === "OrganizerPermissionError") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[api/organizers/[id]] permission check failed", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const name = normalizeText(body.name);
  if (!name) {
    return NextResponse.json({ error: "Името е задължително." }, { status: 400 });
  }

  const cityId = normalizeOptionalCityId(body.city_id);

  const { data: updatedRows, error } = await admin
    .from("organizers")
    .update({
      name,
      description: normalizeText(body.description),
      logo_url: normalizeText(body.logo_url),
      website_url: normalizeText(body.website_url),
      facebook_url: normalizeText(body.facebook_url),
      instagram_url: normalizeText(body.instagram_url),
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
      city_id: cityId,
    })
    .eq("id", id)
    .eq("is_active", true)
    .select("verified")
    .limit(1);

  if (error) {
    console.error("[organizer update]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const updated = updatedRows?.[0];
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, verified: Boolean(updated.verified) });
}
