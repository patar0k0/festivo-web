import { ResearchConfidenceLevel, type ResearchFestivalResult, type ResearchSource } from "@/lib/admin/research/types";

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

    out.push({
      url,
      domain,
      title,
      is_official: isOfficial,
    });
  }

  return out;
}

function normalizeConfidenceLevel(value: unknown, fallback: ResearchConfidenceLevel): ResearchConfidenceLevel {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

export function normalizeResearchResult(raw: ResearchFestivalResult): ResearchFestivalResult {
  const startDate = normalizeDate(raw.start_date);
  const endDate = normalizeDate(raw.end_date);

  return {
    query: raw.query.trim(),
    normalized_query: raw.normalized_query.trim(),
    title: normalizeText(raw.title),
    start_date: startDate,
    end_date: endDate,
    city: normalizeText(raw.city),
    location: normalizeText(raw.location),
    description: normalizeText(raw.description),
    organizer: normalizeText(raw.organizer),
    hero_image: normalizeText(raw.hero_image),
    tags: normalizeTags(raw.tags),
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
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
      : [],
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
  };
}

export function validateDateFieldsOrErrors(raw: ResearchFestivalResult): string[] {
  const errors: string[] = [];

  if (isDateProvided(raw.start_date) && !normalizeDate(raw.start_date)) {
    errors.push("start_date must be a valid date in YYYY-MM-DD format");
  }

  if (isDateProvided(raw.end_date) && !normalizeDate(raw.end_date)) {
    errors.push("end_date must be a valid date in YYYY-MM-DD format");
  }

  return errors;
}

export function validateDateRangeOrError(result: ResearchFestivalResult): string | null {
  if (!result.start_date || !result.end_date) {
    return null;
  }

  if (result.end_date < result.start_date) {
    return "end_date cannot be before start_date";
  }

  return null;
}
