export type CityResolution =
  | { mode: "create"; name: string }
  | { mode: "existing"; id: number }
  | { mode: "none" };

function normalizeOptionalCityId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
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

/**
 * Decides how the PATCH route should resolve the organizer's city.
 * A non-empty `city_name` signals an explicit "add new place" intent and wins over
 * `city_id`; the route then runs resolveOrCreateCity (which dedups against existing rows).
 */
export function decideCityResolution(input: { city_name?: unknown; city_id?: unknown }): CityResolution {
  if (typeof input.city_name === "string") {
    const name = input.city_name.trim();
    if (name.length > 0) {
      return { mode: "create", name };
    }
  }

  const id = normalizeOptionalCityId(input.city_id);
  if (id != null) {
    return { mode: "existing", id };
  }

  return { mode: "none" };
}
