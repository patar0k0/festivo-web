import { toTitleCase } from "@/lib/utils";

export function cityLabelFromSlug(slug: string): string {
  const decoded = decodeURIComponent(slug).replace(/-/g, " ").trim();
  return decoded ? toTitleCase(decoded) : "България";
}

export function cityHref(slug: string) {
  return `/cities/${encodeURIComponent(slug)}`;
}
