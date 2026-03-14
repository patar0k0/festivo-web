export type PendingQualityBucket = "ready" | "needs_fix" | "weak";

type PendingQualityInput = {
  title?: unknown;
  description?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  city_id?: unknown;
  city_guess?: unknown;
  location_name?: unknown;
  location_guess?: unknown;
  organizer_name?: unknown;
  hero_image?: unknown;
  category?: unknown;
  tags?: unknown;
  date_guess?: unknown;
  title_clean?: unknown;
  description_clean?: unknown;
  [key: string]: unknown;
};

export type PendingFestivalQuality = {
  quality_score: number;
  quality_bucket: PendingQualityBucket;
  missing_fields: string[];
  guessed_values: Partial<Record<"city" | "location" | "date", string>>;
  autofilled_fields: string[];
  hero_image_missing: boolean;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDateValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => normalizeText(tag)).filter((tag): tag is string => Boolean(tag));
  }

  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sameText(a: string | null, b: string | null) {
  if (!a || !b) return false;
  return a.toLocaleLowerCase("bg-BG") === b.toLocaleLowerCase("bg-BG");
}

export function assessPendingFestivalQuality(row: PendingQualityInput): PendingFestivalQuality {
  const title = normalizeText(row.title);
  const description = normalizeText(row.description);
  const startDate = normalizeDateValue(row.start_date);
  const endDate = normalizeDateValue(row.end_date);
  const cityId = typeof row.city_id === "number" ? row.city_id : null;
  const cityGuess = normalizeText(row.city_guess);
  const locationName = normalizeText(row.location_name);
  const locationGuess = normalizeText(row.location_guess);
  const organizerName = normalizeText(row.organizer_name);
  const heroImage = normalizeText(row.hero_image);
  const category = normalizeText(row.category);
  const tags = normalizeTags(row.tags);
  const dateGuess = normalizeDateValue(row.date_guess);
  const titleClean = normalizeText(row.title_clean);
  const descriptionClean = normalizeText(row.description_clean);

  const missingFields: string[] = [];

  if (!title) missingFields.push("title");
  if (!description) missingFields.push("description");
  if (!startDate) missingFields.push("start_date");
  if (!endDate) missingFields.push("end_date");
  if (!cityId && !cityGuess) missingFields.push("city");
  if (!locationName && !locationGuess) missingFields.push("location_name");
  if (!organizerName) missingFields.push("organizer_name");
  if (!heroImage) missingFields.push("hero_image");
  if (!category && tags.length === 0) missingFields.push("category_or_tags");

  let score = 0;
  if (title) score += 16;
  if (description) score += 14;
  if (startDate) score += 16;
  if (endDate) score += 8;
  if (cityId || cityGuess) score += cityId ? 12 : 8;
  if (locationName || locationGuess) score += locationName ? 10 : 7;
  if (organizerName) score += 8;
  if (heroImage) score += 8;
  if (category || tags.length > 0) score += 8;

  if (!startDate && dateGuess) {
    score += 4;
  }

  const quality_score = Math.max(0, Math.min(100, score));

  let quality_bucket: PendingQualityBucket = "weak";
  if (quality_score >= 78 && missingFields.length <= 1) {
    quality_bucket = "ready";
  } else if (quality_score >= 48) {
    quality_bucket = "needs_fix";
  }

  const autofilledFields: string[] = [];
  if (sameText(title, titleClean)) {
    autofilledFields.push("title");
  }
  if (sameText(description, descriptionClean)) {
    autofilledFields.push("description");
  }
  if (startDate && dateGuess && startDate === dateGuess) {
    autofilledFields.push("start_date");
  }
  if (locationName && locationGuess && sameText(locationName, locationGuess)) {
    autofilledFields.push("location_name");
  }
  if (!cityId && cityGuess) {
    autofilledFields.push("city_guess_only");
  }

  return {
    quality_score,
    quality_bucket,
    missing_fields: missingFields,
    guessed_values: {
      city: cityGuess ?? undefined,
      location: locationGuess ?? undefined,
      date: dateGuess ?? undefined,
    },
    autofilled_fields: autofilledFields,
    hero_image_missing: !heroImage,
  };
}
