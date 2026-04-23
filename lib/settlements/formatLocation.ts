import { fixMojibakeBG } from "@/lib/text/fixMojibake";

export type ParsedSettlementPrefixKind = "city" | "village" | "resort" | "unknown";

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

function stripResortPrefix(name: string): string {
  return name
    .trim()
    .replace(/^(?:к\.к\.\s*|к\.к\s+|кк\s+|курортен\s+комплекс\s+)/iu, "")
    .trim();
}

export function detectSettlementPrefixKind(trimmedLine: string): {
  kind: ParsedSettlementPrefixKind;
  nameWithoutPrefix: string;
} {
  const t = trimmedLine.trim();
  if (/^(?:к\.к\.|к\.к\b|кк\b|курортен\s+комплекс)/iu.test(t)) {
    return { kind: "resort", nameWithoutPrefix: stripResortPrefix(t) };
  }
  if (/^(?:с\.|село\s+)/iu.test(t)) {
    return { kind: "village", nameWithoutPrefix: stripBulgarianSettlementPrefix(t) };
  }
  if (/^(?:гр\.|град\s+)/iu.test(t)) {
    return { kind: "city", nameWithoutPrefix: stripBulgarianSettlementPrefix(t) };
  }
  return { kind: "unknown", nameWithoutPrefix: stripBulgarianSettlementPrefix(t) };
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

export function resolveSettlementKind(
  dbIsVillage: boolean | null | undefined,
  parsed: ParsedSettlementPrefixKind,
): ParsedSettlementPrefixKind {
  if (dbIsVillage === true) return "village";
  if (dbIsVillage === false) return "city";
  return parsed;
}

function settlementKindToBgLabel(kind: ParsedSettlementPrefixKind): string | null {
  switch (kind) {
    case "village":
      return "село";
    case "city":
      return "град";
    case "resort":
      return "курортен комплекс";
    default:
      return null;
  }
}

export type SettlementLocationLines = {
  primary: string;
  secondary: string | null;
  geoLine: string;
};

function buildSecondaryLine(kind: ParsedSettlementPrefixKind, region: string | null): string | null {
  const typeLabel = settlementKindToBgLabel(kind);
  const bits = [typeLabel, region].filter(Boolean) as string[];
  if (!bits.length) return null;
  return bits.join(" • ");
}

/**
 * Единна логика: чисто име, вторичен ред (тип + област), и ред за карти/ICS.
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

  const { kind: prefixKind, nameWithoutPrefix } = detectSettlementPrefixKind(firstSeg);
  const cleanPrimary = nameWithoutPrefix.trim() || firstSeg.trim();
  if (!cleanPrimary) return null;

  const resolvedKind = resolveSettlementKind(isVillage, prefixKind);
  const secondary = buildSecondaryLine(resolvedKind, regionFromText);
  const geoLine = secondary ? `${cleanPrimary}, ${secondary}` : cleanPrimary;

  return { primary: cleanPrimary, secondary, geoLine };
}
