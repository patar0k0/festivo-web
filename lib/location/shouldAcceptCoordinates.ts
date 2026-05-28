import { scoreGeocodeResult, type GeocodeMeta } from "./scoreGeocodeResult";

export function shouldAcceptCoordinates(meta: GeocodeMeta): boolean {
  const score = scoreGeocodeResult(meta);

  switch (meta.source) {
    case "place_id":
      return score >= 45;
    case "venue+city":
      return score >= 50;
    case "venue+address":
      return score >= 45;
    case "address":
      // Address queries score purely on token overlap — accept at lower threshold.
      // "Лозен, общ. Любимец, обл. Хасково" that returns wrong city scores ~38 → rejected.
      // Correct match scores 70+ → accepted.
      return score >= 42;
    case "venue_only":
      return score >= 40;
    default:
      return score >= 45;
  }
}
