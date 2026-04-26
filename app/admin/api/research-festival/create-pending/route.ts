import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { rehostHeroImageIfRemote, uniqueResearchHeroObjectPath } from "@/lib/admin/rehostHeroImageFromUrl";
import { mapConfidenceToVerificationScore } from "@/lib/admin/research/scoring";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeResearchResult, validateDateFieldsOrErrors, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import {
  resolveCityTextForPending,
  resolvePendingSlugFromResearch,
  resolveVenueTextForPending,
} from "@/lib/admin/research/pendingCreateHandoff";
import { normalizeFestivalTimePair, parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";
import { normalizeFestivalSourceType } from "@/lib/festival/sourceType";
import { parseProgramDraftUnknown, programDraftToPublishPayload } from "@/lib/festival/programDraft";
import { normalizeBgLocation } from "@/lib/location/normalizeBgLocation";
import { resolveEventCoordinates } from "@/lib/location/resolveEventCoordinates";
import { validateCoordinates } from "@/lib/location/validateCoordinates";
import type { ResearchBestGuess, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";
import type { PerplexityFestivalResearchResult } from "@/lib/research/perplexity";

function buildOrganizerEntriesFromAi(ai: PerplexityFestivalResearchResult): Array<{ name: string }> | null {
  const names: string[] = [];
  if (Array.isArray(ai.organizer_names)) {
    for (const n of ai.organizer_names) {
      if (typeof n === "string" && n.trim()) names.push(n.trim());
    }
  }
  if (names.length === 0) {
    const one = sanitizeNullableString(ai.organizer_name);
    if (one) names.push(one);
  }
  if (names.length === 0) return null;
  return names.map((name) => ({ name }));
}

function buildOrganizerEntriesFromResearch(best: ResearchBestGuess): Array<{ name: string }> | null {
  const names: string[] = [];
  if (Array.isArray(best.organizers)) {
    for (const n of best.organizers) {
      if (typeof n === "string" && n.trim()) names.push(n.trim());
    }
  }
  if (names.length === 0 && best.organizer?.trim()) {
    names.push(best.organizer.trim());
  }
  if (names.length === 0) return null;
  return names.map((name) => ({ name }));
}

function primaryNameFromEntries(entries: Array<{ name: string }> | null, fallback: string | null): string | null {
  if (entries && entries.length > 0) return entries[0].name;
  return fallback;
}

type CreatePendingRequest = {
  result?: ResearchFestivalResult;
  ai_result?: PerplexityFestivalResearchResult;
  final_values?: Partial<ResearchBestGuess>;
};

function pickPrimarySource(sources: ResearchSource[]) {
  const official = sources.find((source) => source.is_official);
  return official ?? sources[0] ?? null;
}

function isMissingColumnError(message: string, columnName: string): boolean {
  return message.includes(columnName) || message.includes(`column \"${columnName}\"`) || message.includes(`'${columnName}'`);
}

function extractMissingColumnName(message: string): string | null {
  const fromColumnPattern = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+(?:of\s+relation\s+["'][^"']+["']\s+)?does\s+not\s+exist/i);
  if (fromColumnPattern?.[1]) return fromColumnPattern[1].toLowerCase();

  const fromCouldNotFindPattern = message.match(/could\s+not\s+find\s+the\s+["']([a-zA-Z0-9_]+)["']\s+column/i);
  if (fromCouldNotFindPattern?.[1]) return fromCouldNotFindPattern[1].toLowerCase();

  return null;
}

function sanitizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeSourceUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => sanitizeNullableString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function pickManualCoordsOverride(payload: unknown): {
  coordsOverride: boolean;
  existingLat: number | null;
  existingLng: number | null;
} {
  if (!payload || typeof payload !== "object") {
    return { coordsOverride: false, existingLat: null, existingLng: null };
  }
  const v = payload as Record<string, unknown>;
  if (v.coords_override !== true) {
    return { coordsOverride: false, existingLat: null, existingLng: null };
  }
  const lat =
    typeof v.latitude === "number"
      ? v.latitude
      : typeof v.latitude === "string"
        ? Number(v.latitude)
        : NaN;
  const lng =
    typeof v.longitude === "number"
      ? v.longitude
      : typeof v.longitude === "string"
        ? Number(v.longitude)
        : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { coordsOverride: false, existingLat: null, existingLng: null };
  }
  return { coordsOverride: true, existingLat: lat, existingLng: lng };
}

async function resolveInsertCoordinates(params: {
  placeId: string | null;
  locationLine: string | null;
  cityName: string | null;
  logContext: string;
  coordsOverride?: boolean;
  existingLat?: number | null;
  existingLng?: number | null;
}): Promise<{
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  geocode_provider: string | null;
}> {
  const coords = await resolveEventCoordinates({
    placeId: params.placeId,
    locationName: params.locationLine,
    cityName: params.cityName,
    coordsOverride: params.coordsOverride,
    existingLat: params.existingLat,
    existingLng: params.existingLng,
  });

  if (coords && validateCoordinates(coords, undefined)) {
    console.info("[coords] accepted", { logContext: params.logContext, coords_source: coords.source });
    return {
      latitude: coords.lat,
      longitude: coords.lng,
      place_id: coords.placeId,
      geocode_provider: coords.provider,
    };
  }

  console.warn("[coords] rejected", { logContext: params.logContext, coords_source: coords?.source });
  return {
    latitude: null,
    longitude: null,
    place_id: null,
    geocode_provider: null,
  };
}

async function resolveHeroImageFieldForInsert(heroRaw: string | null): Promise<{ patch: Record<string, unknown> } | { error: string }> {
  if (!heroRaw) {
    return { patch: { hero_image: null } };
  }

  try {
    const supabase = createSupabaseAdmin();
    const outcome = await rehostHeroImageIfRemote(supabase, heroRaw, (ext) => uniqueResearchHeroObjectPath(ext));
    if (!outcome.ok) {
      return { error: outcome.error };
    }

    const patch: Record<string, unknown> = { hero_image: outcome.publicUrl };
    if (outcome.originalUrl) {
      patch.hero_image_original_url = outcome.originalUrl;
      patch.hero_image_source = "url_import";
    }

    return { patch };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Hero image import failed.";
    return { error: message };
  }
}

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const BULGARIAN_DATE_REGEX = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s*г\.)?$/i;

function isValidDateParts(year: number, month: number, day: number): boolean {
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCFullYear() === year && utcDate.getUTCMonth() === month - 1 && utcDate.getUTCDate() === day;
}

function normalizeDateForDb(value: unknown): string | null {
  const sanitized = sanitizeNullableString(value);
  if (!sanitized) return null;

  const isoMatch = sanitized.match(ISO_DATE_REGEX);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isValidDateParts(year, month, day) ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : sanitized;
  }

  const bgMatch = sanitized.match(BULGARIAN_DATE_REGEX);
  if (!bgMatch) return sanitized;

  const day = Number(bgMatch[1]);
  const month = Number(bgMatch[2]);
  const year = Number(bgMatch[3]);
  if (!isValidDateParts(year, month, day)) return sanitized;

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

type AdminContext = NonNullable<Awaited<ReturnType<typeof getAdminContext>>>;

async function insertPendingWithFallback(ctx: AdminContext, payload: Record<string, unknown>) {
  const insertPayload: Record<string, unknown> = { ...payload };
  const removableColumns = new Set([
    "organizer_entries",
    "source_type",
    "website_url",
    "facebook_url",
    "instagram_url",
    "ticket_url",
    "location_name",
    "location_guess",
    "address",
    "category",
    "category_guess",
    "is_free",
    "source_primary_url",
    "source_count",
    "evidence_json",
    "verification_status",
    "verification_score",
    "extraction_version",
    "city_name_display",
    "description_short",
    "program_draft",
    "place_id",
    "geocode_provider",
  ]);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await ctx.supabase.from("pending_festivals").insert(insertPayload).select("id").single();

    if (!error) {
      return NextResponse.json({ ok: true, id: String(data.id) });
    }

    const message = error.message.toLocaleLowerCase("en-US");

    if (attempt === 0 && isMissingColumnError(message, "source_type")) {
      delete insertPayload.source_type;
      continue;
    }

    if (attempt === 0 && message.includes("source_type") && message.includes("check")) {
      insertPayload.source_type = null;
      continue;
    }

    const discoveredMissingColumn = extractMissingColumnName(message);
    if (discoveredMissingColumn && removableColumns.has(discoveredMissingColumn) && discoveredMissingColumn in insertPayload) {
      delete insertPayload[discoveredMissingColumn];
      continue;
    }

    let removedColumn = false;
    for (const column of removableColumns) {
      if (isMissingColumnError(message, column) && column in insertPayload) {
        delete insertPayload[column];
        removedColumn = true;
      }
    }

    if (removedColumn) {
      continue;
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Could not create pending festival after fallback attempts." }, { status: 500 });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CreatePendingRequest | null;

  if (body?.ai_result) {
    const ai = body.ai_result;
    const sourceUrls = sanitizeSourceUrls(ai.source_urls);
    const sourcePrimaryUrl = sourceUrls[0] ?? null;

    const heroResolved = await resolveHeroImageFieldForInsert(sanitizeNullableString(ai.hero_image));
    if ("error" in heroResolved) {
      return NextResponse.json({ error: `Hero image: ${heroResolved.error}` }, { status: 422 });
    }

    const orgEntriesAi = buildOrganizerEntriesFromAi(ai);
    const aiTimes = normalizeFestivalTimePair(
      parseHmInputToDbTime((ai as { start_time?: unknown }).start_time),
      parseHmInputToDbTime((ai as { end_time?: unknown }).end_time),
    );

    const aiInputSourceType = "ai_research";
    const aiNormalizedSourceType = normalizeFestivalSourceType(aiInputSourceType);
    console.info(
      `[research-create-pending] source_type input="${aiInputSourceType}" normalized="${aiNormalizedSourceType ?? ""}"`
    );

    const aiTitle = sanitizeNullableString(ai.title) ?? "Untitled festival";
    const aiCategory = sanitizeNullableString(ai.category);
    const aiCityText = normalizeBgLocation(sanitizeNullableString(ai.city));
    const aiVenue = normalizeBgLocation(sanitizeNullableString(ai.location_name));
    const aiAddress = normalizeBgLocation(sanitizeNullableString(ai.address));
    const aiSlugGuess = sanitizeNullableString(ai.slug);
    const aiLocationLine = aiVenue ?? aiAddress ?? null;
    const aiPlaceId = sanitizeNullableString((ai as { place_id?: unknown }).place_id);
    const manualAi = pickManualCoordsOverride(ai);
    const aiGeoFields = await resolveInsertCoordinates({
      placeId: aiPlaceId,
      locationLine: aiLocationLine,
      cityName: aiCityText,
      logContext: "research-ai",
      coordsOverride: manualAi.coordsOverride,
      existingLat: manualAi.existingLat,
      existingLng: manualAi.existingLng,
    });

    let aiProgramDraftInsert: unknown = null;
    if (ai.program_draft != null) {
      const pd = parseProgramDraftUnknown(ai.program_draft);
      if (!pd.ok) {
        return NextResponse.json({ error: `program_draft: ${pd.error}` }, { status: 400 });
      }
      aiProgramDraftInsert = programDraftToPublishPayload(pd.value);
    }

    const insertPayload: Record<string, unknown> = {
      title: aiTitle,
      slug: resolvePendingSlugFromResearch(aiSlugGuess, aiTitle),
      description: sanitizeNullableString(ai.description),
      category: aiCategory,
      category_guess: aiCategory,
      start_date: normalizeDateForDb(ai.start_date),
      end_date: normalizeDateForDb(ai.end_date),
      start_time: aiTimes.start_time,
      end_time: aiTimes.end_time,
      city_guess: aiCityText,
      city_name_display: aiCityText,
      location_name: aiVenue,
      location_guess: aiVenue,
      address: aiAddress,
      latitude: aiGeoFields.latitude,
      longitude: aiGeoFields.longitude,
      place_id: aiGeoFields.place_id,
      geocode_provider: aiGeoFields.geocode_provider,
      organizer_entries: orgEntriesAi,
      organizer_name: primaryNameFromEntries(orgEntriesAi, sanitizeNullableString(ai.organizer_name)),
      website_url: sanitizeNullableString(ai.website_url),
      facebook_url: sanitizeNullableString(ai.facebook_url),
      instagram_url: sanitizeNullableString(ai.instagram_url),
      ticket_url: sanitizeNullableString(ai.ticket_url),
      ...heroResolved.patch,
      is_free: typeof ai.is_free === "boolean" ? ai.is_free : null,
      source_url: sourcePrimaryUrl,
      source_primary_url: sourcePrimaryUrl,
      source_count: sourceUrls.length,
      evidence_json: {
        provider: "perplexity",
        source_urls: sourceUrls,
        confidence: ai.confidence,
        missing_fields: sanitizeSourceUrls(ai.missing_fields),
      },
      verification_status: ai.confidence,
      verification_score: mapConfidenceToVerificationScore(ai.confidence),
      extraction_version: "research_ai_perplexity_v1",
      source_type: aiNormalizedSourceType,
      status: "pending",
      program_draft: aiProgramDraftInsert,
    };

    return insertPendingWithFallback(ctx, insertPayload);
  }

  if (!body?.result) {
    return NextResponse.json({ error: "result is required" }, { status: 400 });
  }

  const mergedResult: ResearchFestivalResult = {
    ...body.result,
    best_guess: {
      ...body.result.best_guess,
      ...(body.final_values ?? {}),
      tags: Array.isArray(body.final_values?.tags) ? body.final_values.tags : body.result.best_guess.tags,
      organizers: Array.isArray(body.final_values?.organizers)
        ? body.final_values.organizers
        : Array.isArray(body.result.best_guess.organizers)
          ? body.result.best_guess.organizers
          : [],
      slug:
        body.final_values && "slug" in body.final_values ? body.final_values.slug : body.result.best_guess.slug,
      description_short:
        body.final_values && "description_short" in body.final_values
          ? body.final_values.description_short
          : body.result.best_guess.description_short,
      program_draft:
        body.final_values && "program_draft" in body.final_values
          ? body.final_values.program_draft
          : body.result.best_guess.program_draft,
    },
  };

  const dateFieldErrors = validateDateFieldsOrErrors(mergedResult);
  if (dateFieldErrors.length > 0) {
    return NextResponse.json({ error: dateFieldErrors[0] }, { status: 400 });
  }

  const normalized = normalizeResearchResult(mergedResult);
  const dateRangeError = validateDateRangeOrError(normalized);
  if (dateRangeError) {
    return NextResponse.json({ error: dateRangeError }, { status: 400 });
  }

  const primarySource = pickPrimarySource(normalized.sources);
  const fallbackSource = normalized.sources[0] ?? null;
  const sourcePrimaryUrl = primarySource?.url ?? null;
  const sourceUrl = sourcePrimaryUrl ?? fallbackSource?.url ?? null;

  const finalValues = normalized.best_guess;

  let programDraftForInsert: unknown = null;
  if (finalValues.program_draft !== undefined && finalValues.program_draft !== null) {
    const pd = parseProgramDraftUnknown(finalValues.program_draft);
    if (!pd.ok) {
      return NextResponse.json({ error: `program_draft: ${pd.error}` }, { status: 400 });
    }
    programDraftForInsert = programDraftToPublishPayload(pd.value);
  }

  const heroResolvedLegacy = await resolveHeroImageFieldForInsert(sanitizeNullableString(finalValues.hero_image));
  if ("error" in heroResolvedLegacy) {
    return NextResponse.json({ error: `Hero image: ${heroResolvedLegacy.error}` }, { status: 422 });
  }

  const websiteFromForm = sanitizeNullableString(finalValues.website_url);
  const orgEntriesResearch = buildOrganizerEntriesFromResearch(finalValues);

  const resolvedTitle = finalValues.title ?? normalized.query;
  const cityText = normalizeBgLocation(resolveCityTextForPending(finalValues, normalized));
  const venueText = normalizeBgLocation(resolveVenueTextForPending(finalValues, normalized));
  const addressText = normalizeBgLocation(sanitizeNullableString(finalValues.address));
  const locationLine = venueText ?? addressText ?? null;
  const researchPlaceId = sanitizeNullableString((finalValues as { place_id?: unknown }).place_id);
  const manualResearch = pickManualCoordsOverride(finalValues);
  const geoFields = await resolveInsertCoordinates({
    placeId: researchPlaceId,
    locationLine,
    cityName: cityText,
    logContext: "research-web",
    coordsOverride: manualResearch.coordsOverride,
    existingLat: manualResearch.existingLat,
    existingLng: manualResearch.existingLng,
  });
  const categoryText = sanitizeNullableString(finalValues.category);

  const sharedInsertPayload: Record<string, unknown> = {
    title: resolvedTitle,
    slug: resolvePendingSlugFromResearch(finalValues.slug, resolvedTitle),
    description: finalValues.description,
    description_short: sanitizeNullableString(finalValues.description_short),
    city_guess: cityText,
    city_name_display: cityText,
    location_guess: venueText,
    location_name: venueText,
    organizer_entries: orgEntriesResearch,
    organizer_name: primaryNameFromEntries(orgEntriesResearch, finalValues.organizer),
    ...heroResolvedLegacy.patch,
    tags_guess: finalValues.tags,
    start_date: finalValues.start_date,
    end_date: finalValues.end_date,
    start_time: finalValues.start_time ?? null,
    end_time: finalValues.end_time ?? null,
    is_free: finalValues.is_free,
    source_url: sourceUrl,
    website_url: websiteFromForm ?? sourceUrl,
    facebook_url: sanitizeNullableString(finalValues.facebook_url),
    instagram_url: sanitizeNullableString(finalValues.instagram_url),
    ticket_url: sanitizeNullableString(finalValues.ticket_url),
    address: addressText,
    latitude: geoFields.latitude,
    longitude: geoFields.longitude,
    place_id: geoFields.place_id,
    geocode_provider: geoFields.geocode_provider,
    category: categoryText,
    category_guess: categoryText,
    source_primary_url: sourcePrimaryUrl,
    source_count: normalized.sources.length,
    evidence_json: {
      best_guess: normalized.best_guess,
      final_values: finalValues,
      candidates: normalized.candidates,
      confidence: normalized.confidence,
      warnings: normalized.warnings,
      evidence: normalized.evidence,
      sources: normalized.sources,
      metadata: normalized.metadata,
    },
    verification_status: normalized.confidence.overall,
    verification_score: mapConfidenceToVerificationScore(normalized.confidence.overall),
    extraction_version: "research_candidates_v1",
    source_type: normalizeFestivalSourceType("web_research"),
    status: "pending",
    program_draft: programDraftForInsert,
  };

  console.info(
    `[research-create-pending] source_type input="web_research" normalized="${String(sharedInsertPayload.source_type ?? "")}"`
  );

  return insertPendingWithFallback(ctx, sharedInsertPayload);
}
