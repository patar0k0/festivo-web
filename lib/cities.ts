import { toTitleCase } from "@/lib/utils";

export async function resolveCityNameFromSlug(slug: string): Promise<string> {
  const { getCityBySlug } = await import("@/lib/festivals");
  const match = await getCityBySlug(slug);
  if (match?.name) return match.name;

  const decoded = decodeURIComponent(slug).replace(/-/g, " ").trim();
  return decoded ? toTitleCase(decoded) : "България";
}

export function cityHref(slug: string) {
  return `/cities/${encodeURIComponent(slug)}`;
}
