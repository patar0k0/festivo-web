import { scoreGeocodeResult, type GeocodeMeta } from "./scoreGeocodeResult";

export function shouldAcceptCoordinates(meta: GeocodeMeta): boolean {
  const score = scoreGeocodeResult(meta);

  // hard rules
  if (meta.source === "venue_only" && score < 40) return false;
  if (meta.source === "venue+city" && score < 50) return false;

  return score >= 45;
}
