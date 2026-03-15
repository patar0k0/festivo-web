import { ResearchConfidenceLevel, type ResearchDateCandidate, type ResearchFestivalResult, type ResearchFieldCandidate, type ResearchSource } from "@/lib/admin/research/types";
import type { SourceAuthorityTier } from "@/lib/admin/research/source-ranking";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const normalizedIso = parsed.toISOString().slice(0, 10);
  return normalizedIso === text ? text : null;
}

function isDateProvided(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeTags(value: unknown, maxCount = 12): string[] {
  if (!Array.isArray(value)) return [];

  const deduped = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
    if (deduped.size >= maxCount) break;
  }

  return Array.from(deduped);
}

function normalizeSources(value: unknown): ResearchSource[] {
  if (!Array.isArray(value)) return [];

  const out: ResearchSource[] = [];
  for (const source of value) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;

    const url = normalizeText((source as { url?: unknown }).url);
    const domain = normalizeText((source as { domain?: unknown }).domain);
    const title = normalizeText((source as { title?: unknown }).title);
    const isOfficial = (source as { is_official?: unknown }).is_official === true;

    if (!url || !domain || !title) continue;

    out.push({ url, domain, title, is_official: isOfficial });
  }

  return out;
}

function normalizeConfidenceLevel(value: unknown, fallback: ResearchConfidenceLevel): ResearchConfidenceLevel {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

function normalizeTier(value: unknown): SourceAuthorityTier | null {
  return value === "tier1_official" || value === "tier2_reputable" || value === "tier3_reference" || value === "tier4_commercial" || value === "tier5_weak"
    ? value
    : null;
}

function normalizeLanguage(value: unknown): "bg" | "mixed" | "non_bg" | null {
  return value === "bg" || value === "mixed" || value === "non_bg" ? value : null;
}

function normalizeFieldCandidates(value: unknown): ResearchFieldCandidate[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  const out: ResearchFieldCandidate[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidateValue = normalizeText((item as { value?: unknown }).value);
    const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
    if (!candidateValue || !sourceUrl) continue;
    const key = `${candidateValue.toLocaleLowerCase("bg-BG")}::${sourceUrl}`;
    if (deduped.has(key)) continue;
    deduped.add(key);
    out.push({
      value: candidateValue,
      source_url: sourceUrl,
      tier: normalizeTier((item as { tier?: unknown }).tier),
      language: normalizeLanguage((item as { language?: unknown }).language),
    });
  }

  return out;
}

function normalizeDateCandidates(value: unknown): ResearchDateCandidate[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  const out: ResearchDateCandidate[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const startDate = normalizeDate((item as { start_date?: unknown }).start_date);
    const endDate = normalizeDate((item as { end_date?: unknown }).end_date) ?? startDate;
    const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
    if (!startDate || !endDate || !sourceUrl) continue;
    const key = `${startDate}::${endDate}::${sourceUrl}`;
    if (deduped.has(key)) continue;
    deduped.add(key);

    const label = normalizeText((item as { label?: unknown }).label) ?? (startDate === endDate ? startDate : `${startDate} → ${endDate}`);
    out.push({
      start_date: startDate,
      end_date: endDate,
      source_url: sourceUrl,
      label,
      tier: normalizeTier((item as { tier?: unknown }).tier),
      language: normalizeLanguage((item as { language?: unknown }).language),
    });
  }

  return out;
}

export function normalizeResearchResult(raw: ResearchFestivalResult): ResearchFestivalResult {
  const rawBestGuess = raw.best_guess ?? {
    title: raw.title ?? null,
    start_date: raw.start_date ?? null,
    end_date: raw.end_date ?? null,
    city: raw.city ?? null,
    location: raw.location ?? null,
    description: raw.description ?? null,
    organizer: raw.organizer ?? null,
    hero_image: raw.hero_image ?? null,
    tags: raw.tags ?? [],
  };

  const bestGuess = {
    title: normalizeText(rawBestGuess.title),
    start_date: normalizeDate(rawBestGuess.start_date),
    end_date: normalizeDate(rawBestGuess.end_date),
    city: normalizeText(rawBestGuess.city),
    location: normalizeText(rawBestGuess.location),
    description: normalizeText(rawBestGuess.description),
    organizer: normalizeText(rawBestGuess.organizer),
    hero_image: normalizeText(rawBestGuess.hero_image),
    tags: normalizeTags(rawBestGuess.tags),
  };

  const normalized: ResearchFestivalResult = {
    query: raw.query.trim(),
    normalized_query: raw.normalized_query.trim(),
    best_guess: bestGuess,
    candidates: {
      titles: normalizeFieldCandidates(raw.candidates?.titles),
      dates: normalizeDateCandidates(raw.candidates?.dates),
      cities: normalizeFieldCandidates(raw.candidates?.cities),
      locations: normalizeFieldCandidates(raw.candidates?.locations),
      organizers: normalizeFieldCandidates(raw.candidates?.organizers),
    },
    sources: normalizeSources(raw.sources),
    confidence: {
      overall: normalizeConfidenceLevel(raw.confidence.overall, "low"),
      title: normalizeConfidenceLevel(raw.confidence.title, "low"),
      dates: normalizeConfidenceLevel(raw.confidence.dates, "low"),
      city: normalizeConfidenceLevel(raw.confidence.city, "low"),
      location: normalizeConfidenceLevel(raw.confidence.location, "low"),
      description: normalizeConfidenceLevel(raw.confidence.description, "low"),
      organizer: normalizeConfidenceLevel(raw.confidence.organizer, "low"),
      hero_image: normalizeConfidenceLevel(raw.confidence.hero_image, "low"),
    },
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean) : [],
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return null;
            const field = normalizeText((item as { field?: unknown }).field);
            const value = normalizeText((item as { value?: unknown }).value);
            const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
            if (!field || !value || !sourceUrl) return null;
            return { field, value, source_url: sourceUrl };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : [],
    metadata:
      raw.metadata && typeof raw.metadata === "object"
        ? {
            provider: raw.metadata.provider === "web" ? "web" : "mock",
            mode:
              raw.metadata.mode === "real_web"
                ? "real_web"
                : raw.metadata.mode === "special_case_mock"
                  ? "special_case_mock"
                  : "generic_mock",
            source_count:
              typeof raw.metadata.source_count === "number" && Number.isFinite(raw.metadata.source_count)
                ? Math.max(0, Math.floor(raw.metadata.source_count))
                : 0,
          }
        : undefined,
    title: bestGuess.title,
    start_date: bestGuess.start_date,
    end_date: bestGuess.end_date,
    city: bestGuess.city,
    location: bestGuess.location,
    description: bestGuess.description,
    organizer: bestGuess.organizer,
    hero_image: bestGuess.hero_image,
    tags: bestGuess.tags,
  };

  return normalized;
}

export function validateDateFieldsOrErrors(raw: ResearchFestivalResult): string[] {
  const errors: string[] = [];
  const startDate = raw.best_guess?.start_date ?? raw.start_date;
  const endDate = raw.best_guess?.end_date ?? raw.end_date;

  if (isDateProvided(startDate) && !normalizeDate(startDate)) {
    errors.push("start_date must be a valid date in YYYY-MM-DD format");
  }

  if (isDateProvided(endDate) && !normalizeDate(endDate)) {
    errors.push("end_date must be a valid date in YYYY-MM-DD format");
  }

  return errors;
}

export function validateDateRangeOrError(result: ResearchFestivalResult): string | null {
  const startDate = result.best_guess?.start_date ?? result.start_date;
  const endDate = result.best_guess?.end_date ?? result.end_date;

  if (!startDate || !endDate) {
    return null;
  }

  if (endDate < startDate) {
    return "end_date cannot be before start_date";
  }

  return null;
}
