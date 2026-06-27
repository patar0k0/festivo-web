import type { SmartResearchFields } from "./smart-pipeline";

export type SmartResearchPatchTarget = {
  description: string | null;
  website_url: string | null;
  ticket_url: string | null;
  location_name: string | null;
  address: string | null;
  is_free: boolean | null;
  category: string | null;
  start_time: string | null;
  end_time: string | null;
  tags: string[] | null;
};

type ScalarKey =
  | "description"
  | "website_url"
  | "ticket_url"
  | "location_name"
  | "address"
  | "category"
  | "start_time"
  | "end_time";

type PatchRecord = Record<string, unknown>;

function isEmptyScalar(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function isEmptyTagsArray(v: unknown): boolean {
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

/**
 * Fill-null-only diff between smart-research fields and a published festival's
 * current values. Mirrors lib/admin/poster/computeEnrichmentPatch.ts but reads
 * from SmartResearchFields and additionally covers start_time/end_time/tags and
 * program_draft (gated on hasExistingProgram instead of a column check, since
 * the program lives in separate tables, not a festivals column).
 *
 * Returns null if there is nothing to patch.
 */
export function computeSmartResearchPatch(
  fields: SmartResearchFields,
  current: SmartResearchPatchTarget,
  hasExistingProgram: boolean,
): PatchRecord | null {
  const patch: PatchRecord = {};

  const tryFillScalar = (key: ScalarKey, value: string | null | undefined) => {
    if (value === null || value === undefined) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!isEmptyScalar(current[key])) return;
    patch[key] = trimmed;
  };

  tryFillScalar("description", fields.description);
  tryFillScalar("website_url", fields.website_url);
  tryFillScalar("ticket_url", fields.ticket_url);
  tryFillScalar("location_name", fields.location_name);
  tryFillScalar("address", fields.address);
  tryFillScalar("category", fields.category);
  tryFillScalar("start_time", fields.start_time);
  tryFillScalar("end_time", fields.end_time);

  if (fields.is_free !== null && fields.is_free !== undefined && isEmptyScalar(current.is_free)) {
    patch.is_free = fields.is_free;
  }

  if (fields.tags.length > 0 && isEmptyTagsArray(current.tags)) {
    patch.tags = fields.tags;
  }

  if (!hasExistingProgram && fields.program_draft && fields.program_draft.days.length > 0) {
    patch.program_draft = fields.program_draft;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
