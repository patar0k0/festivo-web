import { festivalSettlementDisplayText } from "@/lib/settlements/festivalCityText";

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
  const cityRel =
    row.city && typeof row.city === "object" && !Array.isArray(row.city)
      ? (row.city as { name_bg?: unknown; slug?: unknown })
      : null;
  const effectiveCityText = festivalSettlementDisplayText({
    cityRelation: cityRel
      ? {
          name_bg: typeof cityRel.name_bg === "string" ? cityRel.name_bg : null,
          slug: typeof cityRel.slug === "string" ? cityRel.slug : null,
        }
      : null,
    city_name_display: normalizeText(row.city_name_display),
    city_guess: cityGuess,
  });
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
  if (!cityId && !effectiveCityText) missingFields.push("city");
  if (!locationName && !locationGuess) missingFields.push("location_name");
  if (!organizerName) missingFields.push("organizer_name");
  if (!heroImage) missingFields.push("hero_image");
  if (!category && tags.length === 0) missingFields.push("category_or_tags");

  let score = 0;
  if (title) score += 16;
  if (description) score += 14;
  if (startDate) score += 16;
  if (endDate) score += 8;
  if (cityId || effectiveCityText) score += cityId ? 12 : 8;
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
  if (!cityId && effectiveCityText) {
    autofilledFields.push("city_text_only");
  }

  return {
    quality_score,
    quality_bucket,
    missing_fields: missingFields,
    guessed_values: {
      city: effectiveCityText ?? undefined,
      location: locationGuess ?? undefined,
      date: dateGuess ?? undefined,
    },
    autofilled_fields: autofilledFields,
    hero_image_missing: !heroImage,
  };
}

export type FilledFieldSummary = {
  key: string;
  label: string;
  preview: string;
};

const PREVIEW_MAX = 200;

function truncatePreview(value: string, max = PREVIEW_MAX): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type PendingRecordForFillSummary = {
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  city_id?: unknown;
  city?: { name_bg?: unknown; slug?: unknown } | null;
  city_name_display?: unknown;
  city_guess?: unknown;
  location_name?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  organizer_name?: unknown;
  source_url?: unknown;
  website_url?: unknown;
  ticket_url?: unknown;
  price_range?: unknown;
  hero_image?: unknown;
  hero_image_source?: unknown;
  hero_image_original_url?: unknown;
  hero_image_score?: unknown;
  category?: unknown;
  tags?: unknown;
  title_clean?: unknown;
  description_clean?: unknown;
  description_short?: unknown;
  date_guess?: unknown;
  location_guess?: unknown;
  is_free?: unknown;
  source_type?: unknown;
};

/**
 * Lists non-empty fields on the pending row for quick “what ingest / pipeline filled” visibility.
 * Omits empty values; long text is truncated in previews.
 */
export function listFilledPendingRecordFields(row: PendingRecordForFillSummary): FilledFieldSummary[] {
  const out: FilledFieldSummary[] = [];
  const push = (key: string, label: string, raw: unknown) => {
    if (raw === null || raw === undefined) return;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (!t) return;
      out.push({ key, label, preview: truncatePreview(t) });
      return;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out.push({ key, label, preview: String(raw) });
      return;
    }
    if (typeof raw === "boolean") {
      out.push({ key, label, preview: raw ? "да" : "не" });
    }
  };

  const title = normalizeText(row.title);
  if (title) out.push({ key: "title", label: "Заглавие", preview: truncatePreview(title) });

  const slug = normalizeText(row.slug);
  if (slug) out.push({ key: "slug", label: "Slug", preview: slug });

  const description = normalizeText(row.description);
  if (description) out.push({ key: "description", label: "Описание", preview: truncatePreview(description) });

  const startDate = normalizeDateValue(row.start_date);
  if (startDate) out.push({ key: "start_date", label: "Начална дата", preview: startDate });

  const endDate = normalizeDateValue(row.end_date);
  if (endDate) out.push({ key: "end_date", label: "Крайна дата", preview: endDate });

  const cityId = typeof row.city_id === "number" ? row.city_id : null;
  const cityName = normalizeText(row.city?.name_bg) ?? normalizeText(row.city?.slug);
  const fillCityLine = festivalSettlementDisplayText({
    cityRelation: row.city
      ? {
          name_bg: typeof row.city.name_bg === "string" ? row.city.name_bg : null,
          slug: typeof row.city.slug === "string" ? row.city.slug : null,
        }
      : null,
    city_name_display: normalizeText(row.city_name_display),
    city_guess: normalizeText(row.city_guess),
  });
  if (cityId != null && cityName) {
    out.push({ key: "city_resolved", label: "Град (каноничен)", preview: `${cityName} (id ${cityId})` });
  } else if (cityId != null) {
    out.push({ key: "city_id", label: "Град (id)", preview: String(cityId) });
  } else if (fillCityLine) {
    out.push({ key: "city_text", label: "Град", preview: fillCityLine });
  }

  const cityGuess = normalizeText(row.city_guess);
  if (cityGuess && cityGuess !== fillCityLine) {
    out.push({ key: "city_guess", label: "Предположение за град", preview: cityGuess });
  }

  const locationName = normalizeText(row.location_name);
  if (locationName) out.push({ key: "location_name", label: "Място / venue", preview: truncatePreview(locationName) });

  const locationGuess = normalizeText(row.location_guess);
  if (locationGuess) out.push({ key: "location_guess", label: "Предположение за място", preview: truncatePreview(locationGuess) });

  const address = normalizeText(row.address);
  if (address) out.push({ key: "address", label: "Адрес", preview: truncatePreview(address) });

  const lat = row.latitude;
  const lng = row.longitude;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
    out.push({ key: "coords", label: "Координати", preview: `${lat}, ${lng}` });
  }

  const organizerName = normalizeText(row.organizer_name);
  if (organizerName) out.push({ key: "organizer_name", label: "Организатор", preview: truncatePreview(organizerName) });

  const sourceUrl = normalizeText(row.source_url);
  if (sourceUrl) out.push({ key: "source_url", label: "Източник (URL)", preview: sourceUrl });

  const sourceType = normalizeText(row.source_type);
  if (sourceType) out.push({ key: "source_type", label: "Тип източник", preview: sourceType });

  push("website_url", "Уебсайт", row.website_url);
  push("ticket_url", "Билети (URL)", row.ticket_url);
  push("price_range", "Ценови диапазон", row.price_range);

  const hero = normalizeText(row.hero_image);
  if (hero) out.push({ key: "hero_image", label: "Hero изображение (URL)", preview: truncatePreview(hero, 120) });

  push("hero_image_source", "Hero източник", row.hero_image_source);
  const heroOrig = normalizeText(row.hero_image_original_url);
  if (heroOrig) out.push({ key: "hero_image_original_url", label: "Hero оригинален URL", preview: truncatePreview(heroOrig, 120) });

  if (row.hero_image_score !== null && row.hero_image_score !== undefined && String(row.hero_image_score).trim() !== "") {
    out.push({ key: "hero_image_score", label: "Hero score", preview: String(row.hero_image_score) });
  }

  const category = normalizeText(row.category);
  if (category) out.push({ key: "category", label: "Категория", preview: category });

  const tags = normalizeTags(row.tags);
  if (tags.length) out.push({ key: "tags", label: "Тагове", preview: tags.join(", ") });

  const titleClean = normalizeText(row.title_clean);
  if (titleClean) out.push({ key: "title_clean", label: "Заглавие (нормализирано / AI)", preview: truncatePreview(titleClean) });

  const descriptionClean = normalizeText(row.description_clean);
  if (descriptionClean) out.push({ key: "description_clean", label: "Описание (нормализирано / AI)", preview: truncatePreview(descriptionClean) });

  const descriptionShort = normalizeText(row.description_short);
  if (descriptionShort) out.push({ key: "description_short", label: "Кратко описание", preview: truncatePreview(descriptionShort) });

  const dateGuess = normalizeDateValue(row.date_guess);
  if (dateGuess) out.push({ key: "date_guess", label: "Предположение за дата", preview: dateGuess });

  if (row.is_free === true || row.is_free === false) {
    out.push({ key: "is_free", label: "Безплатно", preview: row.is_free ? "да" : "не" });
  }

  return out;
}
