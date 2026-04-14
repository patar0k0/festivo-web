export function normalizeBgLocation(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  let normalized = value.trim();
  if (!normalized) return null;

  normalized = normalized.replace(/["'`„“”«»]/gu, "");
  normalized = normalized.replace(/(^|[\s,])гр\.\s*/giu, "$1");
  normalized = normalized.replace(/(^|[\s,])с\.\s*/giu, "$1");
  normalized = normalized.replace(/(^|[\s,])пл\.\s*/giu, "$1площад ");
  normalized = normalized.replace(/(^|[\s,])бул\.\s*/giu, "$1булевард ");
  normalized = normalized.replace(/(^|[\s,])ул\.\s*/giu, "$1улица ");

  normalized = normalized.replace(/\s*,\s*/g, ", ");
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.replace(/,+/g, ",");
  normalized = normalized.replace(/^,\s*|\s*,$/g, "");
  normalized = normalized.trim();

  return normalized.length > 0 ? normalized : null;
}
