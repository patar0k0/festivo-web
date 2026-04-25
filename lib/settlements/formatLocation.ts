import { fixMojibakeBG } from "@/lib/text/fixMojibake";

/** Премахва типични представки в началото (за сравнение / нормализация). */
export function stripBulgarianSettlementPrefix(name: string): string {
  return name
    .trim()
    .replace(
      /^(?:гр\.\s*|град\s+|с\.\s*|село\s+|к\.к\.\s*|к\.к\s+|кк\s+|курортен\s+комплекс\s+)/iu,
      "",
    )
    .trim();
}

function normalizeRegionFragment(fragment: string): string {
  const t = fragment.trim();
  if (!t) return "";
  if (/^област\b/iu.test(t)) {
    return `обл. ${t.replace(/^област\s+/iu, "").trim()}`;
  }
  if (/^обл\./iu.test(t)) {
    return `обл. ${t.replace(/^обл\.\s*/iu, "").trim()}`.replace(/\s+/g, " ").trim();
  }
  return t;
}

/**
 * Извлича опашка „обл. …“ от свободен текст след първата запетая.
 * Не приема произволен втори сегмент за област, за да не объркаме адресни добавки.
 */
export function extractOblastTailFromCommaParts(parts: string[]): string | null {
  if (parts.length < 2) return null;
  const idx = parts.findIndex((p, i) => i > 0 && /^(?:обл\.|област\b)/iu.test(p.trim()));
  if (idx === -1) return null;
  const tail = parts
    .slice(idx)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
  const norm = normalizeRegionFragment(tail);
  return norm || null;
}

/**
 * Един източник: `cities.is_village` → city/village label; unknown → no label.
 */
export function resolveSettlementKind(
  isVillage: boolean | null | undefined,
): "city" | "village" | null {
  if (isVillage === true) return "village";
  if (isVillage === false) return "city";
  return null;
}

function settlementKindToBgLabel(kind: "city" | "village"): string {
  return kind === "village" ? "село" : "град";
}

export type SettlementLocationLines = {
  primary: string;
  secondary: string | null;
  geoLine: string;
};

function buildSecondaryLine(kind: "city" | "village" | null, region: string | null): string | null {
  const typeLabel = kind != null ? settlementKindToBgLabel(kind) : null;
  const bits = [typeLabel, region].filter(Boolean) as string[];
  if (!bits.length) return null;
  return bits.join(" • ");
}

/**
 * Единна логика: чисто име, вторичен ред (тип + област), и ред за карти/ICS.
 * Типът идва само от `cities.is_village` (`resolveSettlementKind`); без извод от представки.
 */
export function formatSettlementLocationLines(
  rawLine: string | null | undefined,
  isVillage: boolean | null | undefined,
): SettlementLocationLines | null {
  if (rawLine == null || !String(rawLine).trim()) return null;

  const fixed = fixMojibakeBG(String(rawLine).trim());
  const commaParts = fixed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const firstSeg = commaParts[0] ?? fixed;
  const regionFromText = extractOblastTailFromCommaParts(commaParts);

  const cleanPrimary = stripBulgarianSettlementPrefix(firstSeg).trim() || firstSeg.trim();
  if (!cleanPrimary) return null;

  const resolvedFromData = resolveSettlementKind(isVillage);
  const secondary = buildSecondaryLine(resolvedFromData, regionFromText);
  const geoLine = secondary ? `${cleanPrimary}, ${secondary}` : cleanPrimary;

  return { primary: cleanPrimary, secondary, geoLine };
}
