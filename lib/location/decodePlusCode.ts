import { OpenLocationCode } from "open-location-code";

const coder = new OpenLocationCode();

export function decodePlusCode(code: string): { lat: number; lng: number } | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  try {
    const area = coder.decode(trimmed);
    const lat = area.latitudeCenter;
    const lng = area.longitudeCenter;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
