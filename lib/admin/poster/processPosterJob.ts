import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadTelegramFile } from "@/lib/telegram/getTelegramFile";
import { posterBufferToInline } from "@/lib/admin/poster/posterImageToInline";
import { uploadPosterImage } from "@/lib/admin/poster/uploadPosterImage";
import { extractFestivalFromPoster } from "@/lib/admin/poster/posterExtractor";
import { buildPosterPendingRow } from "@/lib/admin/poster/posterPendingRowBuilder";
import { findDuplicateFestivals, type DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";
import type { PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";
import { enrichPosterFromWeb } from "@/lib/admin/poster/enrichPosterFromWeb";

const DUP_BLOCK_SCORE = 0.5;

export type ProcessResult =
  | { kind: "inserted"; pendingId: string; title: string; needsReview: boolean }
  | { kind: "duplicate"; matches: DuplicateMatch[]; extraction: PosterExtraction; heroUrl: string; title: string }
  | { kind: "error"; message: string };

/** Full pipeline for a single poster: download → extract → dedup → build → insert. */
export async function processPosterFromFile(
  supabase: SupabaseClient,
  fileId: string,
  caption: string,
): Promise<ProcessResult> {
  try {
    const { buffer, mimeType } = await downloadTelegramFile(fileId);
    const inline = await posterBufferToInline(buffer);
    const heroUrl = await uploadPosterImage(supabase, buffer, mimeType);

    const rawExtraction = await extractFestivalFromPoster({ image: inline, caption });

    // Pass 2: web enrichment — fills null/needs_review fields from grounded search
    const extraction = await enrichPosterFromWeb(rawExtraction, rawExtraction.title.value ?? caption);

    const built = await buildPosterPendingRow(extraction, heroUrl);
    if (!built.ok) return { kind: "error", message: built.error };

    // Duplicate gate: strong, same-year title match → ask the operator first.
    const matches = await findDuplicateFestivals({ title: built.title, startDate: built.startDate });
    const strong = matches.filter((m) => m.score >= DUP_BLOCK_SCORE && m.same_year);
    if (strong.length > 0) {
      return { kind: "duplicate", matches: strong, extraction, heroUrl, title: built.title };
    }

    return await insertPosterRow(supabase, built.row, built.title);
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Poster processing failed" };
  }
}

/** Insert a pre-built row (used directly and after a duplicate-confirm "create"). */
export async function insertPosterRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  title: string,
): Promise<ProcessResult> {
  const { data, error } = await supabase.from("pending_festivals").insert(row).select("id").single();
  if (error) return { kind: "error", message: error.message };
  if (!data?.id) return { kind: "error", message: "Insert returned no id" };
  return {
    kind: "inserted",
    pendingId: String(data.id),
    title,
    needsReview: Boolean((row as { needs_review?: unknown }).needs_review),
  };
}

/** Rebuild + insert from a stored extraction (duplicate-confirm "create" path). */
export async function insertFromStoredExtraction(
  supabase: SupabaseClient,
  extraction: PosterExtraction,
  heroUrl: string,
): Promise<ProcessResult> {
  const built = await buildPosterPendingRow(extraction, heroUrl);
  if (!built.ok) return { kind: "error", message: built.error };
  return insertPosterRow(supabase, built.row, built.title);
}
