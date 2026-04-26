import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeBgLocation } from "@/lib/location/normalizeBgLocation";
import { geocodeByPlaceId } from "@/lib/location/geocodeLocation";
import { resolveEventCoordinates } from "@/lib/location/resolveEventCoordinates";

type GeocodeBody = {
  location_name?: unknown;
  city?: unknown;
  place_id?: unknown;
  coords_override?: unknown;
  existing_lat?: unknown;
  existing_lng?: unknown;
};

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** `GET /api/admin/geocode?place_id=...` — admin-only; returns lat/lng for a Google place_id. */
export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const placeId = asOptionalString(searchParams.get("place_id"));
  if (!placeId) {
    return NextResponse.json({ ok: false, error: "place_id required", lat: null, lng: null }, { status: 400 });
  }

  const geo = await geocodeByPlaceId(placeId);
  if (!geo) {
    return NextResponse.json({ ok: true, lat: null, lng: null, place_id: null, provider: null });
  }

  return NextResponse.json({
    ok: true,
    lat: geo.lat,
    lng: geo.lng,
    place_id: geo.placeId,
    provider: geo.provider,
  });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as GeocodeBody | null;
  const locationName = normalizeBgLocation(asOptionalString(body?.location_name));
  const city = normalizeBgLocation(asOptionalString(body?.city));
  const placeId = asOptionalString(body?.place_id);
  const coordsOverride = body?.coords_override === true;
  const existingLat = asFiniteNumber(body?.existing_lat);
  const existingLng = asFiniteNumber(body?.existing_lng);

  const resolved = await resolveEventCoordinates({
    placeId,
    locationName,
    cityName: city,
    coordsOverride: coordsOverride && existingLat !== null && existingLng !== null,
    existingLat,
    existingLng,
  });

  return NextResponse.json({
    ok: true,
    lat: resolved?.lat ?? null,
    lng: resolved?.lng ?? null,
    place_id: resolved?.placeId ?? null,
    provider: resolved?.provider ?? null,
    coords_source: resolved?.source ?? null,
  });
}
