import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { mapConfidenceToVerificationScore } from "@/lib/admin/research/scoring";
import { normalizeResearchResult, validateDateFieldsOrErrors, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import type { ResearchBestGuess, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";
import type { PerplexityFestivalResearchResult } from "@/lib/research/perplexity";

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
    "source_type",
    "website_url",
    "facebook_url",
    "instagram_url",
    "ticket_url",
    "location_name",
    "address",
    "category",
    "is_free",
    "source_primary_url",
    "source_count",
    "evidence_json",
    "verification_status",
    "verification_score",
    "extraction_version",
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
    if (discoveredMissingColumn) {
      if (removableColumns.has(discoveredMissingColumn)) {
        if (discoveredMissingColumn in insertPayload) {
          delete insertPayload[discoveredMissingColumn];
          continue;
        }
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
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

    const insertPayload: Record<string, unknown> = {
      title: sanitizeNullableString(ai.title) ?? "Untitled festival",
      description: sanitizeNullableString(ai.description),
      category: sanitizeNullableString(ai.category),
      start_date: normalizeDateForDb(ai.start_date),
      end_date: normalizeDateForDb(ai.end_date),
      location_name: sanitizeNullableString(ai.location_name),
      address: sanitizeNullableString(ai.address),
      organizer_name: sanitizeNullableString(ai.organizer_name),
      website_url: sanitizeNullableString(ai.website_url),
      facebook_url: sanitizeNullableString(ai.facebook_url),
      instagram_url: sanitizeNullableString(ai.instagram_url),
      ticket_url: sanitizeNullableString(ai.ticket_url),
      hero_image: sanitizeNullableString(ai.hero_image),
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
      source_type: "ai_research",
      status: "pending",
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

  const sharedInsertPayload: Record<string, unknown> = {
    title: finalValues.title ?? normalized.query,
    description: finalValues.description,
    city_guess: finalValues.city,
    location_guess: finalValues.location,
    organizer_name: finalValues.organizer,
    hero_image: finalValues.hero_image,
    tags_guess: finalValues.tags,
    start_date: finalValues.start_date,
    end_date: finalValues.end_date,
    is_free: finalValues.is_free,
    source_url: sourceUrl,
    website_url: sourceUrl,
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
    source_type: "web_research",
    status: "pending",
  };

  return insertPendingWithFallback(ctx, sharedInsertPayload);
}
