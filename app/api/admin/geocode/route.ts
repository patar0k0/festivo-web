import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeBgLocation } from "@/lib/location/normalizeBgLocation";
import { geocodeLocation } from "@/lib/location/geocodeLocation";

type GeocodeBody = {
  location_name?: unknown;
  city?: unknown;
};

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as GeocodeBody | null;
  const locationName = normalizeBgLocation(asOptionalString(body?.location_name));
  const city = normalizeBgLocation(asOptionalString(body?.city));

  if (!city) {
    return NextResponse.json({ ok: true, lat: null, lng: null, place_id: null, provider: null });
  }

  const query = locationName ? `${locationName}, ${city}, България` : null;
  const geo = query ? await geocodeLocation(query) : null;

  return NextResponse.json({
    ok: true,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    place_id: geo?.placeId ?? null,
    provider: geo?.provider ?? null,
  });
}
