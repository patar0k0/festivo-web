import "server-only";
import { buildResearchPendingRowFromRequest } from "@/lib/admin/ingest/researchPendingRowFromRequest";
import type { PerplexityFestivalResearchResult } from "@/lib/research/perplexity";
import type { PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";
import { isoFromComponents, programToGeminiShape, contactNote } from "@/lib/admin/poster/buildPosterPendingRow.mjs";

export type BuildPosterRowResult =
  | { ok: true; row: Record<string, unknown>; title: string; startDate: string | null }
  | { ok: false; error: string };

/**
 * Maps the validated poster extraction to the research `ai_result` shape and
 * reuses `buildResearchPendingRowFromRequest` (geocode + hero + quality pipeline),
 * then stamps poster-specific provenance. `heroPublicUrl` must already be a public
 * URL in our hero bucket (from uploadPosterImage).
 */
export async function buildPosterPendingRow(
  ext: PosterExtraction,
  heroPublicUrl: string | null,
  now: Date = new Date(),
): Promise<BuildPosterRowResult> {
  const startDate = isoFromComponents(ext.start_date, now);
  const endDate = isoFromComponents(ext.end_date, now) ?? startDate;
  const festivalYear = startDate ? Number(startDate.slice(0, 4)) : now.getUTCFullYear();

  const title = ext.title.value?.trim() || ext.title_candidates[0] || "Фестивал (от плакат)";

  // Compose description with the contact note appended (no contact column).
  const baseDesc = ext.description.value?.trim() || "";
  const note = contactNote(ext.contact);
  const description = [baseDesc, note].filter(Boolean).join("\n\n") || null;

  const organizerNames = ext.organizer_names.length
    ? ext.organizer_names
    : ext.organizer_name.value
      ? [ext.organizer_name.value]
      : [];

  const aiResult = {
    title,
    source_urls: [],
    hero_image: heroPublicUrl,
    gallery_image_urls: [],
    organizer_name: organizerNames[0] ?? null,
    organizer_names: organizerNames,
    start_date: startDate,
    end_date: endDate,
    start_time: ext.start_time.value,
    end_time: ext.end_time.value,
    category: ext.category.value,
    city: ext.city.value,
    location_name: ext.venue_name.value,
    address: ext.address.value,
    description,
    is_free: ext.is_free.value,
    price_range: ext.price_range.value,
    website_url: ext.website_url.value,
    facebook_url: ext.facebook_url.value,
    instagram_url: ext.instagram_url.value,
    ticket_url: ext.ticket_url.value,
    tags: ext.tags,
    program_draft: programToGeminiShape(ext.program, festivalYear),
    confidence: ext.title.confidence,
    missing_fields: [],
  } as unknown as PerplexityFestivalResearchResult;

  const built = await buildResearchPendingRowFromRequest({ ai_result: aiResult });
  if (!built.ok) return { ok: false, error: built.error };

  const row = { ...built.row };
  // Poster-specific provenance + raw signals for the moderator.
  row.extraction_version = "telegram_poster_vision_v1";
  const ev = row.evidence_json && typeof row.evidence_json === "object" ? { ...(row.evidence_json as Record<string, unknown>) } : {};
  row.evidence_json = {
    ...ev,
    ingest_channel: "telegram_poster",
    contact: ext.contact,
    other_dates: ext.other_dates,
    title_candidates: ext.title_candidates,
  };
  // Carry the model's needs_review intent onto the row.
  const needsReview =
    ext.title.needs_review || ext.category.needs_review || ext.is_free.needs_review || !startDate || !ext.start_time.value;
  row.needs_review = Boolean((row as { needs_review?: unknown }).needs_review) || needsReview;
  row.verification_status = "needs_review";

  return { ok: true, row, title, startDate };
}
