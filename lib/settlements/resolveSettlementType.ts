import dataset from "@/data/bg-settlements.json";
import cities from "@/data/bg-cities.json";

/**
 * Strips common Bulgarian settlement prefixes. Escapes dots in the pattern so
 * e.g. "гр." is literal, not "гр" + any character.
 */
const LEADING_SETTLEMENT_PREFIX = /^(?:гр\.|с\.|к\.к\.)\s*/iu;

/** Resort/holiday complexes are neither a town nor a village. */
const RESORT_RAW_PREFIX = /^\s*(?:к\.?\s*к\.?|кк|курортен\s+комплекс)(?=\s|$)/iu;
const RESORT_NAMES = new Set(["боровец", "мальовица", "пампорово"]);

/** Authoritative list of Bulgarian towns/cities (EKATTE/НСИ), normalized lower-case. */
const CITY_SET = new Set((cities as string[]).map((n) => n.toLocaleLowerCase("bg-BG").trim()));

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
 * Infers settlement type: `true` = село, `false` = град, `null` = неприложимо
 * (курорт/местност или празно).
 *
 * Order: resort guard → explicit prefix in the raw text → manual dataset override
 * → authoritative city list → default село. The default is "село" because ~95% of
 * Bulgarian settlements are villages, so an unrecognised name is far more likely a
 * village than a town — and this keeps newly-ingested places from defaulting to "гр."
 * (the original root cause of the misclassification).
 */
export function resolveSettlementType(name: string): boolean | null {
  if (!name?.trim()) {
    return null;
  }

  // 0) resort/holiday complex → neither
  if (RESORT_RAW_PREFIX.test(name)) {
    return null;
  }

  const key = normalize(name);
  if (!key) {
    return null;
  }
  if (RESORT_NAMES.has(key)) {
    return null;
  }

  // 1) explicit prefix in the supplied text (authoritative for that input)
  const mild = name.toLocaleLowerCase("bg-BG").trim();
  if (/^с\.\s/u.test(mild) || /^село\s/u.test(mild)) {
    return true;
  }
  if (/^гр\.\s/u.test(mild) || /^град\s/u.test(mild)) {
    return false;
  }

  // 2) manual dataset override (village/town/city)
  const v = (dataset as Record<string, string>)[key];
  if (v === "village") {
    return true;
  }
  if (v === "city" || v === "town") {
    return false;
  }

  // 3) authoritative city list
  if (CITY_SET.has(key)) {
    return false;
  }

  // 4) default: a settlement that is not a known town is a village
  return true;
}
