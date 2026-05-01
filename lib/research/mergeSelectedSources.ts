import { scoreFestivalData, validateFestivalData } from "@/lib/admin/research/festivalDataQuality";
import { parseFlexibleDateToIso } from "@/lib/dates/euDateFormat";
import type { AiResearchConfidence, PerplexityFestivalResearchResult } from "@/lib/research/perplexity";
import { researchFestivalFromSingleUrl } from "@/lib/research/perplexity";

export type MergeResearchApiResponse = {
  merged_result: PerplexityFestivalResearchResult;
  sources_used: string[];
  confidence_score: number;
  needs_review: boolean;
  extraction_errors?: Array<{ url: string; message: string }>;
};

const MAX_MERGE_URLS = 10;
const DESC_JOIN_MAX = 800;
const TITLE_MIN_LEN = 4;

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw.trim();
    if (!u) continue;
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

function normalizeDateForCompare(value: string | null): string | null {
  if (!value?.trim()) return null;
  const iso = parseFlexibleDateToIso(value.trim());
  return iso || null;
}

function isNonGarbageTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < TITLE_MIN_LEN) return false;
  if (/^[^\p{L}\p{N}]+$/u.test(t)) return false;
  if (/^(untitled|home|page|events?)\s*$/i.test(t)) return false;
  return true;
}

function isValidMergeSourceSlice(r: PerplexityFestivalResearchResult): boolean {
  return Boolean(
    (r.title?.trim() && isNonGarbageTitle(r.title)) || r.start_date?.trim() || r.city?.trim(),
  );
}

/** Deterministic merge: majority or conservative fallbacks (earliest start, latest end, mode city, etc.). */
export function mergeSources(sources: PerplexityFestivalResearchResult[]): Omit<
  PerplexityFestivalResearchResult,
  "confidence" | "missing_fields" | "source_urls" | "research_report"
> & { source_urls: string[] } {
  if (sources.length === 0) {
    throw new Error("mergeSources: no sources");
  }

  const titles = sources
    .map((s) => s.title?.trim() ?? "")
    .filter((t) => t && isNonGarbageTitle(t));
  const title =
    titles.length === 0
      ? null
      : titles.reduce((best, t) => (t.length > (best?.length ?? 0) ? t : best), titles[0]!);

  const pickDate = (field: "start_date" | "end_date", mode: "earliest" | "latest"): string | null => {
    const rawVals = sources.map((s) => s[field]?.trim() ?? "").filter(Boolean);
    if (rawVals.length === 0) return null;
    const normalized = rawVals.map((v) => ({ raw: v, iso: normalizeDateForCompare(v) }));
    const comparable = normalized.filter((x): x is { raw: string; iso: string } => x.iso != null);
    if (comparable.length === 0) {
      return rawVals[0] ?? null;
    }
    const counts = new Map<string, number>();
    for (const { iso } of comparable) {
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    for (const [iso, c] of counts) {
      if (c >= 2) {
        const hit = comparable.find((x) => x.iso === iso);
        return hit?.raw ?? iso;
      }
    }
    const times = comparable.map((x) => ({ raw: x.raw, t: Date.parse(x.iso) }));
    const finite = times.filter((x) => Number.isFinite(x.t));
    if (finite.length === 0) return comparable[0]!.raw;
    if (mode === "earliest") {
      const m = finite.reduce((a, b) => (b.t < a.t ? b : a));
      return m.raw;
    }
    const m = finite.reduce((a, b) => (b.t > a.t ? b : a));
    return m.raw;
  };

  const start_date = pickDate("start_date", "earliest");
  const end_date = pickDate("end_date", "latest");

  const cities = sources.map((s) => s.city?.trim() ?? "").filter(Boolean);
  const city = (() => {
    if (cities.length === 0) return null;
    const counts = new Map<string, number>();
    for (const c of cities) {
      const k = c.toLocaleLowerCase("bg-BG");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let bestKey = "";
    let bestN = -1;
    for (const [k, n] of counts) {
      if (n > bestN || (n === bestN && k.localeCompare(bestKey, "bg-BG") < 0)) {
        bestN = n;
        bestKey = k;
      }
    }
    const original = cities.find((c) => c.toLocaleLowerCase("bg-BG") === bestKey);
    return original ?? cities[0] ?? null;
  })();

  const locs = sources.map((s) => s.location_name?.trim() ?? "").filter(Boolean);
  const location_name =
    locs.length === 0 ? null : locs.reduce((a, b) => (b.length > a.length ? b : a), locs[0]!);

  const descriptions: string[] = [];
  const seenDesc = new Set<string>();
  for (const s of sources) {
    const d = s.description?.trim();
    if (!d) continue;
    const key = d.replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
    if (seenDesc.has(key)) continue;
    seenDesc.add(key);
    descriptions.push(d);
  }
  let description: string | null = descriptions.length === 0 ? null : descriptions.join("\n\n");
  if (description && description.length > DESC_JOIN_MAX) {
    description = `${description.slice(0, DESC_JOIN_MAX - 3)}...`;
  }

  const hero_image =
    sources.map((s) => s.hero_image?.trim()).find((u) => u && /^https?:\/\//i.test(u)) ?? null;

  const firstStringField = (field: keyof PerplexityFestivalResearchResult): string | null => {
    for (const s of sources) {
      const v = s[field];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const organizer_name = firstStringField("organizer_name");
  const organizer_names = (() => {
    const names: string[] = [];
    for (const s of sources) {
      if (Array.isArray(s.organizer_names)) {
        for (const n of s.organizer_names) {
          if (typeof n === "string" && n.trim()) names.push(n.trim());
        }
      } else if (s.organizer_name?.trim()) {
        names.push(s.organizer_name.trim());
      }
    }
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const n of names) {
      const k = n.toLocaleLowerCase("bg-BG");
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(n);
    }
    return uniq.length > 0 ? uniq : null;
  })();

  const category = firstStringField("category");
  const address = firstStringField("address");
  const slug = firstStringField("slug");

  const website_url = firstStringField("website_url");
  const facebook_url = firstStringField("facebook_url");
  const instagram_url = firstStringField("instagram_url");
  const ticket_url = firstStringField("ticket_url");

  let is_free: boolean | null = null;
  for (const s of sources) {
    if (typeof s.is_free === "boolean") {
      is_free = s.is_free;
      break;
    }
  }

  const source_urls = dedupeUrls(
    sources.flatMap((s) => (Array.isArray(s.source_urls) ? s.source_urls : []).filter((u) => typeof u === "string")),
  );

  return {
    title,
    description,
    category,
    start_date,
    end_date,
    slug,
    city,
    location_name,
    address,
    organizer_name,
    organizer_names,
    website_url,
    facebook_url,
    instagram_url,
    ticket_url,
    hero_image,
    is_free,
    program_draft: null,
    source_urls: source_urls.length > 0 ? source_urls : [],
  };
}

function aiTierFromNumericScore(score: number): AiResearchConfidence {
  if (score >= 72) return "high";
  if (score >= 48) return "medium";
  return "low";
}

function missingFieldsFromValidation(missing: string[]): string[] {
  const out: string[] = [...missing];
  if (missing.includes("start_date") && !out.includes("end_date")) {
    /* keep list minimal */
  }
  return out;
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<void>): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

/**
 * Fetch each URL with {@link researchFestivalFromSingleUrl}, drop empty extractions, merge with {@link mergeSources}.
 */
export async function mergeSelectedResearchUrls(
  urls: string[],
  query: string,
  options?: { snippetsByUrl?: Record<string, string | undefined | null> },
): Promise<MergeResearchApiResponse> {
  const unique = dedupeUrls(urls);
  if (unique.length === 0) {
    throw new Error("At least one URL is required.");
  }
  if (unique.length > MAX_MERGE_URLS) {
    throw new Error(`At most ${MAX_MERGE_URLS} URLs.`);
  }

  const hint = query.trim();
  const snippets = options?.snippetsByUrl ?? {};

  const extractionErrors: Array<{ url: string; message: string }> = [];
  const results: PerplexityFestivalResearchResult[] = [];
  const urlOrder: string[] = [];

  const slot: Array<PerplexityFestivalResearchResult | null> = new Array(unique.length).fill(null);

  await mapPool(unique, 3, async (url, index) => {
    try {
      const snippet = snippets[url] ?? null;
      const r = await researchFestivalFromSingleUrl(url, {
        queryHint: hint || undefined,
        snippetFallback: typeof snippet === "string" ? snippet : null,
      });
      slot[index] = r;
    } catch (e) {
      extractionErrors.push({ url, message: e instanceof Error ? e.message : "Extraction failed" });
      slot[index] = null;
    }
  });

  for (let i = 0; i < unique.length; i++) {
    const url = unique[i]!;
    const r = slot[i];
    if (!r) continue;
    if (!isValidMergeSourceSlice(r)) continue;
    results.push(r);
    urlOrder.push(url);
  }

  if (results.length === 0) {
    throw new Error("No valid extracted data from the selected URLs. Try other sources or preview each URL first.");
  }

  const mergedCore = mergeSources(results);

  const sources_used =
    mergedCore.source_urls.length > 0 ? mergedCore.source_urls : dedupeUrls(urlOrder.length > 0 ? urlOrder : unique);

  const pseudoRow: Record<string, unknown> = {
    title: mergedCore.title,
    start_date: normalizeDateForCompare(mergedCore.start_date) ?? mergedCore.start_date,
    city_guess: mergedCore.city,
    city_name_display: mergedCore.city,
    location_name: mergedCore.location_name,
    location_guess: mergedCore.location_name,
    source_url: sources_used[0] ?? null,
    source_primary_url: sources_used[0] ?? null,
    address: mergedCore.address,
  };

  const { score: structural } = scoreFestivalData(pseudoRow);
  const multiBonus = Math.min(24, Math.max(0, (sources_used.length - 1) * 8));
  let confidence_score = Math.min(100, structural + multiBonus);
  if (extractionErrors.length > 0) {
    confidence_score = Math.max(0, confidence_score - 5);
  }

  const validation = validateFestivalData(pseudoRow);
  const needs_review =
    validation.needs_review ||
    sources_used.length < 2 ||
    confidence_score < 55 ||
    extractionErrors.length > 0;

  const confidence = aiTierFromNumericScore(confidence_score);
  const missing_fields = missingFieldsFromValidation(validation.missing);

  const merged_result: PerplexityFestivalResearchResult = {
    ...mergedCore,
    source_urls: sources_used,
    confidence,
    missing_fields,
    research_report: undefined,
  };

  return {
    merged_result,
    sources_used,
    confidence_score,
    needs_review,
    ...(extractionErrors.length > 0 ? { extraction_errors: extractionErrors } : {}),
  };
}
