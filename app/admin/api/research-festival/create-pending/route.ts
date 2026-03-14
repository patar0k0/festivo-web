import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { mapConfidenceToVerificationScore } from "@/lib/admin/research/scoring";
import { normalizeResearchResult, validateDateFieldsOrErrors, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import type { ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

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

  const body = (await request.json().catch(() => null)) as { result?: ResearchFestivalResult } | null;
  if (!body?.result) {
    return NextResponse.json({ error: "result is required" }, { status: 400 });
  }

  const dateFieldErrors = validateDateFieldsOrErrors(body.result);
  if (dateFieldErrors.length > 0) {
    return NextResponse.json({ error: dateFieldErrors[0] }, { status: 400 });
  }

  const normalized = normalizeResearchResult(body.result);
  const dateRangeError = validateDateRangeOrError(normalized);
  if (dateRangeError) {
    return NextResponse.json({ error: dateRangeError }, { status: 400 });
  }

  const primarySource = pickPrimarySource(normalized.sources);
  const fallbackSource = normalized.sources[0] ?? null;
  const sourcePrimaryUrl = primarySource?.url ?? null;
  const sourceUrl = sourcePrimaryUrl ?? fallbackSource?.url ?? null;

  const sharedInsertPayload: Record<string, unknown> = {
    title: normalized.title ?? normalized.query,
    description: normalized.description,
    city_guess: normalized.city,
    location_guess: normalized.location,
    organizer_name: normalized.organizer,
    hero_image: normalized.hero_image,
    tags_guess: normalized.tags,
    start_date: normalized.start_date,
    end_date: normalized.end_date,
    source_url: sourceUrl,
    source_primary_url: sourcePrimaryUrl,
    source_count: normalized.sources.length,
    evidence_json: {
      confidence: normalized.confidence,
      warnings: normalized.warnings,
      evidence: normalized.evidence,
      sources: normalized.sources,
      metadata: normalized.metadata,
    },
    verification_status: normalized.confidence.overall,
    verification_score: mapConfidenceToVerificationScore(normalized.confidence.overall),
    extraction_version: "research_mvp_v1",
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
