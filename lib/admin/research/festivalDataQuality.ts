import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSourceDocument } from "@/lib/admin/research/source-extract";
import { parseFlexibleDateToIso } from "@/lib/dates/euDateFormat";
import { normalizeBgLocation } from "@/lib/location/normalizeBgLocation";
import { resolveEventCoordinates } from "@/lib/location/resolveEventCoordinates";
import { validateCoordinates } from "@/lib/location/validateCoordinates";

const PLACEHOLDER_TITLE = /^untitled festival$/i;
const MAX_SOURCE_FETCHES = 3;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function collectSourceUrls(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (u: string | null) => {
    if (!u) return;
    try {
      const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        const s = parsed.toString();
        if (!out.includes(s)) out.push(s);
      }
    } catch {
      /* skip */
    }
  };

  push(str(row.source_url));
  push(str(row.source_primary_url));
  push(str(row.website_url));

  const ev = row.evidence_json;
  if (ev && typeof ev === "object" && !Array.isArray(ev)) {
    const e = ev as Record<string, unknown>;
    const urls = e.source_urls;
    if (Array.isArray(urls)) {
      for (const u of urls) push(str(u));
    }
    const sources = e.sources;
    if (Array.isArray(sources)) {
      for (const s of sources) {
        if (s && typeof s === "object" && "url" in s) push(str((s as { url?: unknown }).url));
      }
    }
  }

  return out.slice(0, MAX_SOURCE_FETCHES * 2);
}

function extractIsoDatesFromText(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(/\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/g)) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    const ok = parseFlexibleDateToIso(iso);
    if (ok && !seen.has(ok)) {
      seen.add(ok);
      found.push(ok);
    }
  }

  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[.](20\d{2}|19\d{2})(?:\s*г\.)?\b/gi)) {
    const raw = `${m[1]}.${m[2]}.${m[3]}`;
    const ok = parseFlexibleDateToIso(raw);
    if (ok && !seen.has(ok)) {
      seen.add(ok);
      found.push(ok);
    }
  }

  return found;
}

async function loadCityNamesOrderedByLength(): Promise<string[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("cities").select("name_bg").not("name_bg", "is", null).limit(15000);

  if (error) {
    console.warn("[festivalDataQuality] cities load failed", error.message);
    return [];
  }

  const names = (data ?? [])
    .map((r) => (typeof r.name_bg === "string" ? r.name_bg.trim() : ""))
    .filter((n) => n.length >= 3);

  return [...new Set(names)].sort((a, b) => b.length - a.length);
}

function findCityInText(text: string, cityNames: string[]): string | null {
  const hay = text.toLocaleLowerCase("bg-BG");
  for (const name of cityNames) {
    const needle = name.toLocaleLowerCase("bg-BG");
    if (needle.length < 3) continue;
    const idx = hay.indexOf(needle);
    if (idx === -1) continue;
    const before = idx > 0 ? hay[idx - 1] : " ";
    const after = idx + needle.length < hay.length ? hay[idx + needle.length] : " ";
    const boundaryOk = !/[а-яёa-z0-9]/i.test(before) && !/[а-яёa-z0-9]/i.test(after);
    if (boundaryOk || name.length >= 6) return name;
  }
  return null;
}

function suggestVenueFromText(text: string, cityName: string | null): string | null {
  const hall = text.match(/\b(?:зала|Зала)\s*[„""']?([А-Яа-яA-Za-z0-9\s\-–—.]+?)(?:[„""']|,|\.|$)/);
  if (hall?.[1]) {
    const v = normalizeBgLocation(hall[1].trim());
    if (v && v.length > 2 && v.length < 160) return v;
  }

  const inCity = cityName
    ? text.match(new RegExp(`(?:в|В)\\s+(?:гр\\.?|с\\.?)?\\s*${cityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s,–—-]+([А-Яа-яA-Za-z0-9\\s\\-–—.]{4,80})`))
    : null;
  if (inCity?.[1]) {
    const v = normalizeBgLocation(inCity[1].trim());
    if (v && v.length > 2) return v;
  }

  return null;
}

function suggestVenueFromDescription(desc: string | null): string | null {
  if (!desc) return null;
  const first = desc.split(/\n+/)[0]?.split(/\.+/)[0]?.trim();
  if (first && first.length >= 8 && first.length < 200 && /[а-яА-Я]/.test(first)) return normalizeBgLocation(first);
  return null;
}

/**
 * Fetch primary source pages and fill missing title, dates, city, venue from HTML/text.
 */
export async function enrichFestivalData(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const next = { ...row };
  const urls = collectSourceUrls(next);
  const fetchedUrls: string[] = [];
  const texts: string[] = [];
  const pageTitles: string[] = [];

  const desc = str(next.description);
  if (desc) texts.push(desc);

  for (const url of urls.slice(0, MAX_SOURCE_FETCHES)) {
    const doc = await fetchSourceDocument(url).catch(() => null);
    if (!doc) continue;
    fetchedUrls.push(doc.url);
    if (doc.title?.trim()) pageTitles.push(doc.title.trim());
    texts.push(`${doc.title}\n${doc.excerpt}`);
  }

  const corpus = texts.join("\n\n");
  if (!corpus.trim()) return next;

  const cityNames = await loadCityNamesOrderedByLength();
  const cityHit = findCityInText(corpus, cityNames);

  const titleNow = str(next.title);
  const bestPageTitle = pageTitles.find((t) => t.length > 3 && t.length < 200 && !/^home\b/i.test(t));
  if ((!titleNow || PLACEHOLDER_TITLE.test(titleNow)) && bestPageTitle) {
    next.title = bestPageTitle.replace(/\s+/g, " ").trim();
  }

  if (!str(next.city_guess) && !str(next.city_name_display) && cityHit) {
    const c = normalizeBgLocation(cityHit);
    if (c) {
      next.city_guess = c;
      next.city_name_display = c;
    }
  }

  const dates = extractIsoDatesFromText(corpus);
  if (!str(next.start_date) && dates.length > 0) {
    dates.sort();
    next.start_date = dates[0];
  }
  if (!str(next.end_date) && dates.length > 1) {
    dates.sort();
    next.end_date = dates[dates.length - 1];
  }

  if (!str(next.location_name)) {
    const cityLabel = str(next.city_guess) ?? str(next.city_name_display);
    const venue = suggestVenueFromText(corpus, cityLabel) ?? suggestVenueFromDescription(desc);
    if (venue) {
      next.location_name = venue;
      next.location_guess = venue;
    }
  }

  const meta = (next.evidence_json && typeof next.evidence_json === "object" && !Array.isArray(next.evidence_json)
    ? { ...(next.evidence_json as Record<string, unknown>) }
    : {}) as Record<string, unknown>;

  const trackKeys = [
    "title",
    "start_date",
    "end_date",
    "city_guess",
    "city_name_display",
    "location_name",
    "location_guess",
  ] as const;
  const filled_keys = trackKeys.filter((k) => next[k] != null && next[k] !== row[k]);

  meta.post_ai_quality = {
    ...(typeof meta.post_ai_quality === "object" && meta.post_ai_quality !== null
      ? (meta.post_ai_quality as Record<string, unknown>)
      : {}),
    enrich: {
      fetched_urls: fetchedUrls,
      dates_found: dates,
      city_match: cityHit,
      filled_keys,
    },
  };
  next.evidence_json = meta;

  return next;
}

export type ValidateFestivalDataResult = {
  needs_review: boolean;
  missing: string[];
};

/**
 * Required: title, start_date, city (city_guess or city_name_display).
 */
export function validateFestivalData(row: Record<string, unknown>): ValidateFestivalDataResult {
  const missing: string[] = [];

  const title = str(row.title);
  if (!title || PLACEHOLDER_TITLE.test(title)) missing.push("title");

  const start = str(row.start_date);
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) missing.push("start_date");

  const city = str(row.city_guess) ?? str(row.city_name_display);
  if (!city) missing.push("city");

  return {
    needs_review: missing.length > 0,
    missing,
  };
}

export type ScoreFestivalDataResult = {
  score: number;
  breakdown: Record<string, number>;
};

/**
 * Structural completeness 0–100 (not model confidence).
 */
export function scoreFestivalData(row: Record<string, unknown>): ScoreFestivalDataResult {
  const breakdown: Record<string, number> = {};

  const title = str(row.title);
  if (title && !PLACEHOLDER_TITLE.test(title)) breakdown.title = 20;

  const start = str(row.start_date);
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) breakdown.date = 30;

  const city = str(row.city_guess) ?? str(row.city_name_display);
  if (city) breakdown.city = 30;

  const venue = str(row.location_name) ?? str(row.location_guess) ?? str(row.address);
  if (venue) breakdown.venue = 10;

  const src = str(row.source_url) ?? str(row.source_primary_url);
  if (src) breakdown.source_url = 10;

  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
  return { score, breakdown };
}

async function refineCoordinatesIfNeeded(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const city = normalizeBgLocation(str(row.city_guess) ?? str(row.city_name_display));
  if (!city) return row;

  const hasCoords =
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude);

  if (hasCoords) return row;

  const venue = str(row.location_name) ?? str(row.location_guess) ?? str(row.address);
  const coords = await resolveEventCoordinates({
    placeId: str(row.place_id),
    locationName: venue,
    cityName: city,
  });

  if (coords && validateCoordinates(coords, undefined)) {
    return {
      ...row,
      latitude: coords.lat,
      longitude: coords.lng,
      place_id: coords.placeId ?? row.place_id,
      geocode_provider: coords.provider ?? row.geocode_provider,
    };
  }

  return row;
}

/**
 * enrich → optional geocode refill → validate → score; sets confidence_score, needs_review, evidence_json.post_ai_quality.
 */
export async function applyResearchRowQualityPipeline(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  let next = await enrichFestivalData(row);
  next = await refineCoordinatesIfNeeded(next);

  const validation = validateFestivalData(next);
  const { score, breakdown } = scoreFestivalData(next);

  const ev = (next.evidence_json && typeof next.evidence_json === "object" && !Array.isArray(next.evidence_json)
    ? { ...(next.evidence_json as Record<string, unknown>) }
    : {}) as Record<string, unknown>;

  ev.post_ai_quality = {
    ...(typeof ev.post_ai_quality === "object" && ev.post_ai_quality !== null
      ? (ev.post_ai_quality as Record<string, unknown>)
      : {}),
    validate: { needs_review: validation.needs_review, missing: validation.missing },
    score: { value: score, breakdown, max: 100 },
  };

  return {
    ...next,
    evidence_json: ev,
    confidence_score: score,
    needs_review: validation.needs_review,
  };
}
