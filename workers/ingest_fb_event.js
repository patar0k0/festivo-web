function normalizeISODate(value) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function hasValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function extractDescription({ fbEvent = {}, ogMeta = {} }) {
  const fbDescription = typeof fbEvent.description === "string" ? fbEvent.description.trim() : "";
  if (fbDescription) return fbDescription;

  const ogDescription = typeof ogMeta.description === "string" ? ogMeta.description.trim() : "";
  if (ogDescription) return ogDescription;

  return "";
}

function extractDates({ fbEvent = {}, existing = {} }) {
  const parsedStartDate = normalizeISODate(fbEvent.start_time);
  const parsedEndDate = normalizeISODate(fbEvent.end_time);

  const nextStartDate = parsedStartDate ?? (hasValidDate(existing.start_date) ? existing.start_date : null);
  const nextEndDate = parsedEndDate ?? parsedStartDate ?? (hasValidDate(existing.end_date) ? existing.end_date : null);

  return {
    start_date: nextStartDate,
    end_date: nextEndDate,
  };
}

function extractLocation({ fbEvent = {}, existing = {} }) {
  const place = fbEvent.place && typeof fbEvent.place === "object" ? fbEvent.place : null;
  const placeLocation = place && typeof place.location === "object" ? place.location : null;

  const locationName = typeof place?.name === "string" && place.name.trim() ? place.name.trim() : existing.location_name ?? null;

  const latitude =
    typeof placeLocation?.latitude === "number"
      ? placeLocation.latitude
      : typeof existing.latitude === "number"
        ? existing.latitude
        : null;

  const longitude =
    typeof placeLocation?.longitude === "number"
      ? placeLocation.longitude
      : typeof existing.longitude === "number"
        ? existing.longitude
        : null;

  return {
    location_name: locationName,
    latitude,
    longitude,
  };
}

function buildPendingFestivalPatch({ fbEvent = {}, ogMeta = {}, existing = {} }) {
  const description = extractDescription({ fbEvent, ogMeta });
  const dates = extractDates({ fbEvent, existing });
  const location = extractLocation({ fbEvent, existing });

  const payload = {
    title: typeof fbEvent.name === "string" ? fbEvent.name.trim() : existing.title ?? "",
    description,
    hero_image:
      typeof fbEvent.cover?.source === "string" && fbEvent.cover.source.trim()
        ? fbEvent.cover.source.trim()
        : typeof ogMeta.image === "string" && ogMeta.image.trim()
          ? ogMeta.image.trim()
          : existing.hero_image ?? null,
    ...dates,
    ...location,
  };

  console.log(`[ingest] title="${payload.title}"`);
  console.log(`[ingest] start_date=${payload.start_date ?? ""}`);
  console.log(`[ingest] location="${payload.location_name ?? ""}"`);

  return payload;
}

module.exports = {
  buildPendingFestivalPatch,
  extractDates,
  extractDescription,
  extractLocation,
  normalizeISODate,
};
