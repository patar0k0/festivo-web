import { validateFestivalData } from "@/lib/admin/research/festivalDataQuality";
import type { SupabaseClient } from "@supabase/supabase-js";
import { festivalSettlementSourceText } from "@/lib/settlements/festivalCityText";
import { augmentPendingRowForValidation, getFastReviewMissingLabels } from "@/lib/admin/pendingFestivalReviewMissing";

export type FastReviewPendingItem = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  city_label: string;
  venue_label: string;
  confidence_score: number | null;
  source_count: number | null;
  needs_review: boolean;
  evidence_json: unknown;
  submission_source: string | null;
  created_at: string;
  source_url: string | null;
  missing_labels: string[];
  validate_needs_review: boolean;
};

type CityRel = { id: number; name_bg: string | null; slug: string | null } | null;

function normalizeCityRel(city: unknown): CityRel {
  if (!city) return null;
  const c = Array.isArray(city) ? city[0] : city;
  if (!c || typeof c !== "object") return null;
  const id = "id" in c && typeof c.id === "number" ? c.id : null;
  if (id == null) return null;
  return {
    id,
    name_bg: "name_bg" in c && typeof c.name_bg === "string" ? c.name_bg : null,
    slug: "slug" in c && typeof c.slug === "string" ? c.slug : null,
  };
}

export async function buildFastReviewItem(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<FastReviewPendingItem | null> {
  const { data: row, error } = await supabase
    .from("pending_festivals")
    .select(
      "id,title,description,start_date,end_date,location_name,location_guess,address,city_id,city_guess,city_name_display,confidence_score,source_count,needs_review,evidence_json,submission_source,created_at,source_url,city:cities(id,name_bg,slug)",
    )
    .eq("id", pendingId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!row) {
    return null;
  }

  const city = normalizeCityRel(row.city);
  const city_label =
    festivalSettlementSourceText({
      cityRelation: city ? { name_bg: city.name_bg, slug: city.slug } : null,
      city_name_display: typeof row.city_name_display === "string" ? row.city_name_display : null,
      city_guess: typeof row.city_guess === "string" ? row.city_guess : null,
    }) ?? "";

  const venue_label =
    (typeof row.location_name === "string" && row.location_name.trim()
      ? row.location_name.trim()
      : null) ??
    (typeof row.location_guess === "string" && row.location_guess.trim()
      ? row.location_guess.trim()
      : null) ??
    (typeof row.address === "string" && row.address.trim() ? row.address.trim() : null) ??
    "";

  const asRecord = row as unknown as Record<string, unknown>;
  const forVal = augmentPendingRowForValidation(asRecord);
  const v = validateFestivalData(forVal);

  return {
    id: String(row.id),
    title: typeof row.title === "string" && row.title.trim() ? row.title : "(untitled)",
    description: typeof row.description === "string" ? row.description : null,
    start_date: typeof row.start_date === "string" ? row.start_date : null,
    end_date: typeof row.end_date === "string" ? row.end_date : null,
    city_label,
    venue_label,
    confidence_score: row.confidence_score ?? null,
    source_count: row.source_count ?? null,
    needs_review: Boolean(row.needs_review),
    evidence_json: row.evidence_json ?? null,
    submission_source: typeof row.submission_source === "string" ? row.submission_source : null,
    created_at: row.created_at,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    missing_labels: getFastReviewMissingLabels(asRecord),
    validate_needs_review: v.needs_review,
  };
}
