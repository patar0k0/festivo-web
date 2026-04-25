import dataset from "@/data/bg-settlements.json";

/**
 * Strips common Bulgarian settlement prefixes. Escapes dots in the pattern so
 * e.g. "гр." is literal, not "гр" + any character.
 */
const LEADING_SETTLEMENT_PREFIX = /^(?:гр\.|с\.|к\.к\.)\s*/iu;

function stripLeadingPrefixes(s: string): string {
  let t = s;
  let previous: string;
  do {
    previous = t;
    t = t.replace(LEADING_SETTLEMENT_PREFIX, "");
  } while (t !== previous);
  return t.trim();
}

function normalize(name: string): string {
  if (!name) {
    return "";
  }

  return stripLeadingPrefixes(name.toLocaleLowerCase("bg-BG").trim().replace(/\s+/g, " "));
}

/**
 * Infers whether a place is a village: `true` = село, `false` = град/селище,
 * `null` = unknown. Dataset always wins over heuristics; never overwrites
 * are decided by callers.
 */
export function resolveSettlementType(name: string): boolean | null {
  if (!name?.trim()) {
    return null;
  }

  const key = normalize(name);
  if (!key) {
    return null;
  }

  // 1) dataset (authoritative)
  const v = (dataset as Record<string, string>)[key];
  if (v === "village") {
    return true;
  }
  if (v === "city" || v === "town") {
    return false;
  }

  // 2) heuristic fallback (only after the dataset; safe patterns)
  const mild = name.toLocaleLowerCase("bg-BG").trim().replace(/\s+/g, " ");
  if (mild.match(/^с\./u) || key.includes("село")) {
    return true;
  }
  if (mild.match(/^гр\./u) || key.includes("град")) {
    return false;
  }

  // 3) unknown
  return null;
}
