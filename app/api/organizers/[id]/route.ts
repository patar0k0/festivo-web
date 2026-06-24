import { NextResponse } from "next/server";
import { assertCanEditOrganizer } from "@/lib/organizer/permissions";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { decideCityResolution } from "@/lib/organizer/resolveCityUpdate";
import { resolveOrCreateCity } from "@/lib/admin/resolveOrCreateCity";

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
  city_name?: unknown;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

  let cityId: number | null = null;
  const cityResolution = decideCityResolution({ city_name: body.city_name, city_id: body.city_id });
  if (cityResolution.mode === "create") {
    try {
      const resolved = await resolveOrCreateCity(cityResolution.name);
      cityId = resolved.city?.id ?? null;
    } catch (error) {
      console.error("[api/organizers/[id]] city resolve failed", error);
      return NextResponse.json({ error: "Невалидно населено място." }, { status: 400 });
    }
  } else if (cityResolution.mode === "existing") {
    cityId = cityResolution.id;
  }

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
    .select("verified,city_id")
    .limit(1);

  if (error) {
    console.error("[organizer update]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const updated = updatedRows?.[0];
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, verified: Boolean(updated.verified), city_id: updated.city_id ?? null });
}
