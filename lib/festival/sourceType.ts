const CANONICAL_FESTIVAL_SOURCE_TYPES = new Set([
  "scraped",
  "manual",
  "claimed",
  "facebook",
  "facebook_event",
  "organizer_portal",
]);

const SOURCE_TYPE_ALIASES: Record<string, string> = {
  ai_research: "manual",
  web_research: "manual",
  research: "manual",
  admin_research: "manual",
  pipeline: "manual",
};

function sanitizeSourceType(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function isResearchLikeSourceType(value: string): boolean {
  return value.includes("research") || value.includes("pipeline");
}

export function normalizeFestivalSourceType(value: string | null | undefined): string | null {
  const normalized = sanitizeSourceType(value);
  if (!normalized) return null;

  if (CANONICAL_FESTIVAL_SOURCE_TYPES.has(normalized)) {
    return normalized;
  }

  const aliased = SOURCE_TYPE_ALIASES[normalized];
  if (aliased) return aliased;

  if (isResearchLikeSourceType(normalized)) {
    return "manual";
  }

  return normalized;
}

export function isCanonicalFestivalSourceType(value: string | null | undefined): boolean {
  const normalized = sanitizeSourceType(value);
  if (!normalized) return false;
  return CANONICAL_FESTIVAL_SOURCE_TYPES.has(normalized);
}
