import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSettlementType } from "@/lib/settlements/resolveSettlementType";

/**
 * After a city is resolved/linked, fills `cities.is_village` from dataset + heuristics
 * when still unknown, without overwriting a non-null value. Logs and optionally records
 * unclassified names for review.
 */
export async function applySettlementTypeInference(
  supabase: SupabaseClient,
  cityId: number,
  cityName: string
): Promise<void> {
  const inferred = resolveSettlementType(cityName);

  const { data: city, error: readError } = await supabase
    .from("cities")
    .select("is_village")
    .eq("id", cityId)
    .maybeSingle();

  if (readError) {
    throw new Error(`[settlement] read cities.is_village failed: ${readError.message}`);
  }

  if (city && city.is_village == null && inferred !== null) {
    const { error: updateError } = await supabase.from("cities").update({ is_village: inferred }).eq("id", cityId);
    if (updateError) {
      throw new Error(`[settlement] update cities.is_village failed: ${updateError.message}`);
    }
  }

  if (inferred === null && process.env.NODE_ENV === "development") {
    console.warn("[settlement] unknown city", { cityName });
  }

  const stillUnknown = city && city.is_village == null;
  const logUnknownsEnabled = process.env.FESTIVO_SETTLEMENT_UNKNOWNS_LOG === "1";
  if (logUnknownsEnabled && inferred === null && stillUnknown) {
    const { error: logError } = await supabase.from("settlement_unknowns").insert({ name: cityName });
    if (logError) {
      if (logError.code === "23505") {
        // duplicate in unique index; ignore
      } else if (process.env.NODE_ENV === "development") {
        console.warn("[settlement] settlement_unknowns insert failed (table may be missing in local DB):", logError.message);
      }
    }
  }
}

/**
 * Uses the service role client for inference side effects, matching the city-creation path
 * and avoiding RLS gaps for optional `settlement_unknowns` logging.
 */
export async function applySettlementTypeInferenceForResolvedCity(cityId: number, cityName: string): Promise<void> {
  const admin = createSupabaseAdmin();
  await applySettlementTypeInference(admin, cityId, cityName);
}
