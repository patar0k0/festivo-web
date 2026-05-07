import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeLocationKey } from "@/lib/location/normalizeLocationKey";
import { saveLocationCache } from "@/lib/location/locationCache";

type Body = {
  key?: unknown;
  location_name?: unknown;
  city_name?: unknown;
  lat?: unknown;
  lng?: unknown;
  score?: unknown;
};

function asOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Admin-only: upsert `location_cache` at max confidence (manual pin). */
export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const locationName = asOptionalTrimmedString(body?.location_name);
  const cityName = asOptionalTrimmedString(body?.city_name);
  const keyRaw = asOptionalTrimmedString(body?.key);
  const key = keyRaw ?? normalizeLocationKey(locationName, cityName);
  const lat = asFiniteNumber(body?.lat);
  const lng = asFiniteNumber(body?.lng);
  const score = asFiniteNumber(body?.score) ?? 100;

  if (!key || lat === null || lng === null) {
    return NextResponse.json({ ok: false, error: "key (or location fields), lat, and lng are required" }, { status: 400 });
  }

  const saved = await saveLocationCache({
    key,
    locationName,
    cityName,
    lat,
    lng,
    score,
    replaceExisting: true,
  });

  if (!saved) {
    return NextResponse.json({ ok: false, error: "Cache write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, key });
}
