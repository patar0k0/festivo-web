import type { PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";

export type EnrichmentTargetType = "pending" | "festival";

type PatchRecord = Record<string, unknown>;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/**
 * Computes which fields from the poster extraction should be applied to the
 * target record. Only fills fields where the target currently has a null/empty
 * value AND the extraction has a non-null value.
 *
 * Returns null if there is nothing to patch.
 */
export function computeEnrichmentPatch(
  extraction: PosterExtraction,
  currentValues: PatchRecord,
  targetType: EnrichmentTargetType,
): PatchRecord | null {
  const patch: PatchRecord = {};

  const tryFill = (field: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (!isEmpty(currentValues[field])) return;
    patch[field] = value;
  };

  tryFill("description", extraction.description.value?.trim() || null);
  tryFill("facebook_url", extraction.facebook_url.value?.trim() || null);
  tryFill("website_url", extraction.website_url.value?.trim() || null);
  tryFill("instagram_url", extraction.instagram_url.value?.trim() || null);
  tryFill("ticket_url", extraction.ticket_url.value?.trim() || null);
  tryFill("location_name", extraction.venue_name.value?.trim() || null);
  tryFill("address", extraction.address.value?.trim() || null);
  tryFill("category", extraction.category.value?.trim() || null);

  // is_free is boolean: false is a valid value, only skip if extraction has null
  if (extraction.is_free.value !== null && extraction.is_free.value !== undefined) {
    if (isEmpty(currentValues["is_free"])) {
      patch["is_free"] = extraction.is_free.value;
    }
  }

  // program_draft only applies to pending_festival targets
  if (targetType === "pending" && extraction.program !== null) {
    if (isEmpty(currentValues["program_draft"])) {
      patch["program_draft"] = extraction.program;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
