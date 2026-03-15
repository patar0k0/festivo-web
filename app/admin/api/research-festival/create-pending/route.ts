import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { mapConfidenceToVerificationScore } from "@/lib/admin/research/scoring";
import { normalizeResearchResult, validateDateFieldsOrErrors, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import type { ResearchBestGuess, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

type CreatePendingRequest = {
  result?: ResearchFestivalResult;
  final_values?: Partial<ResearchBestGuess>;
};

function pickPrimarySource(sources: ResearchSource[]) {
  const official = sources.find((source) => source.is_official);
  return official ?? sources[0] ?? null;
}

function isMissingColumnError(message: string, columnName: string): boolean {
  return message.includes(columnName) || message.includes(`column \"${columnName}\"`) || message.includes(`'${columnName}'`);
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CreatePendingRequest | null;
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
    source_url: sourceUrl,
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

  const insertPayload: Record<string, unknown> = { ...sharedInsertPayload };

  for (let attempt = 0; attempt < 2; attempt += 1) {
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

    if (isMissingColumnError(message, "source_primary_url")) delete insertPayload.source_primary_url;
    if (isMissingColumnError(message, "source_count")) delete insertPayload.source_count;
    if (isMissingColumnError(message, "evidence_json")) delete insertPayload.evidence_json;
    if (isMissingColumnError(message, "verification_status")) delete insertPayload.verification_status;
    if (isMissingColumnError(message, "verification_score")) delete insertPayload.verification_score;
    if (isMissingColumnError(message, "extraction_version")) delete insertPayload.extraction_version;

    const { data: retryData, error: retryError } = await ctx.supabase.from("pending_festivals").insert(insertPayload).select("id").single();
    if (!retryError) {
      return NextResponse.json({ ok: true, id: String(retryData.id) });
    }

    return NextResponse.json({ error: retryError.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Could not create pending festival." }, { status: 500 });
}
