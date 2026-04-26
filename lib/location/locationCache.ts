import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CachedLocationRow = {
  id: string;
  normalized_key: string;
  location_name: string | null;
  city_name: string | null;
  latitude: number;
  longitude: number;
  confidence_score: number | null;
  created_at: string;
};

export async function getCachedLocation(key: string): Promise<CachedLocationRow | null> {
  if (!key) return null;

  const admin = supabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("location_cache")
    .select("id, normalized_key, location_name, city_name, latitude, longitude, confidence_score, created_at")
    .eq("normalized_key", key)
    .maybeSingle();

  if (error) {
    console.warn("[coords] cache_lookup_error", { key, message: error.message });
    return null;
  }

  return data as CachedLocationRow | null;
}

export async function saveLocationCache(params: {
  key: string;
  locationName: string | null | undefined;
  cityName: string | null | undefined;
  lat: number;
  lng: number;
  score: number;
  /** When true, upsert updates an existing row (e.g. admin manual pin at max confidence). */
  replaceExisting?: boolean;
}): Promise<boolean> {
  const replace = params.replaceExisting === true;
  if (!params.key) return false;
  if (params.score < 60) return false;

  const admin = supabaseAdmin();
  if (!admin) return false;

  const { data, error } = await admin
    .from("location_cache")
    .upsert(
      {
        normalized_key: params.key,
        location_name: typeof params.locationName === "string" ? params.locationName : null,
        city_name: typeof params.cityName === "string" ? params.cityName : null,
        latitude: params.lat,
        longitude: params.lng,
        confidence_score: params.score,
      },
      { onConflict: "normalized_key", ignoreDuplicates: !replace },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[coords] cache_save_error", { key: params.key, message: error.message });
    return false;
  }

  return Boolean(data);
}
