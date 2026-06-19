import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";
import { computeEnrichmentPatch } from "@/lib/admin/poster/computeEnrichmentPatch";
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";

export type EnrichResult =
  | { ok: true; kind: "patched_pending"; fields: string[] }
  | { ok: true; kind: "proposal_created"; fields: string[] }
  | { ok: true; kind: "nothing_to_patch" }
  | { ok: false; error: string };

/**
 * Applies fill-null-only enrichment from a poster extraction to an existing
 * festival (pending or published).
 *
 * - pending target  → UPDATE pending_festivals in-place, set enriched_fields
 * - festival target → INSERT festival_enrichment_proposals for admin review
 */
export async function applyPosterEnrichment(
  supabase: SupabaseClient,
  extraction: PosterExtraction,
  target: DuplicateMatch,
  posterIngestJobId: string | null,
): Promise<EnrichResult> {
  try {
    if (target.table === "pending") {
      const { data: current, error: fetchErr } = await supabase
        .from("pending_festivals")
        .select(
          "description,facebook_url,website_url,instagram_url,ticket_url,location_name,address,is_free,category,program_draft",
        )
        .eq("id", target.id)
        .maybeSingle();

      if (fetchErr || !current) {
        return { ok: false, error: fetchErr?.message ?? "Pending festival not found" };
      }

      const patch = computeEnrichmentPatch(extraction, current as Record<string, unknown>, "pending");
      if (!patch) return { ok: true, kind: "nothing_to_patch" };

      const fields = Object.keys(patch);

      const { error: updateErr } = await supabase
        .from("pending_festivals")
        .update({
          ...patch,
          enriched_fields: fields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);

      if (updateErr) return { ok: false, error: updateErr.message };
      return { ok: true, kind: "patched_pending", fields };
    }

    // published festival target — festivals has no facebook_url/instagram_url columns
    const { data: current, error: fetchErr } = await supabase
      .from("festivals")
      .select("description,website_url,ticket_url,location_name,address,is_free,category")
      .eq("id", target.id)
      .maybeSingle();

    if (fetchErr || !current) {
      return { ok: false, error: fetchErr?.message ?? "Festival not found" };
    }

    const patch = computeEnrichmentPatch(extraction, current as Record<string, unknown>, "festival");
    if (!patch) return { ok: true, kind: "nothing_to_patch" };

    const fields = Object.keys(patch);

    const { error: insertErr } = await supabase.from("festival_enrichment_proposals").insert({
      target_festival_id: target.id,
      patch_json: patch,
      poster_ingest_job_id: posterIngestJobId ?? null,
    });

    if (insertErr) return { ok: false, error: insertErr.message };
    return { ok: true, kind: "proposal_created", fields };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
