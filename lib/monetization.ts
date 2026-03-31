import type { SupabaseClient } from "@supabase/supabase-js";

export type OrganizerVipStatusRow = {
  id?: string | null;
  plan?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  included_promotions_per_year?: number | null;
};

type OrganizerCreditRow = {
  id: string;
  plan?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  included_promotions_per_year?: number | null;
};

type OrganizerPromotionCreditsRow = {
  organizer_id: string;
  credit_year: number;
  included_total: number;
  used_total: number;
};

type PromotionStatusRow = {
  promotion_status?: string | null;
  promotion_started_at?: string | null;
  promotion_expires_at?: string | null;
};

const DEFAULT_VIP_INCLUDED_PROMOTIONS_PER_YEAR = 3;

export function isVipOrganizer(organizer: OrganizerVipStatusRow | null | undefined): boolean {
  return organizer?.plan === "vip";
}

export function hasActiveVip(
  organizer: OrganizerVipStatusRow | null | undefined,
  nowDate: Date = new Date(),
): boolean {
  if (!isVipOrganizer(organizer)) return false;

  const start = organizer?.plan_started_at ? new Date(organizer.plan_started_at) : null;
  const end = organizer?.plan_expires_at ? new Date(organizer.plan_expires_at) : null;

  if (start && !Number.isNaN(start.getTime()) && nowDate < start) return false;
  if (end && !Number.isNaN(end.getTime()) && nowDate > end) return false;
  return true;
}

export function hasActivePromotion(
  festival: PromotionStatusRow | null | undefined,
  nowDate: Date = new Date(),
): boolean {
  if (festival?.promotion_status !== "promoted") return false;

  const rawEnd = festival?.promotion_expires_at;
  if (rawEnd == null || rawEnd === "") return true;

  const end = new Date(rawEnd);
  if (Number.isNaN(end.getTime())) return true;

  return nowDate < end;
}

function includedForOrganizer(organizer: OrganizerCreditRow): number {
  if (!hasActiveVip(organizer)) return 0;
  if (organizer.included_promotions_per_year === null || typeof organizer.included_promotions_per_year === "undefined") {
    return DEFAULT_VIP_INCLUDED_PROMOTIONS_PER_YEAR;
  }
  if (!Number.isFinite(organizer.included_promotions_per_year)) {
    return DEFAULT_VIP_INCLUDED_PROMOTIONS_PER_YEAR;
  }
  return Math.max(0, Math.trunc(organizer.included_promotions_per_year));
}

async function getOrCreatePromotionCreditsRow(
  supabase: SupabaseClient,
  organizer: OrganizerCreditRow,
  year: number,
): Promise<OrganizerPromotionCreditsRow> {
  if (!organizer.id) {
    throw new Error("Organizer id is required for promotion credit operations.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("organizer_promotion_credits")
    .select("organizer_id,credit_year,included_total,used_total")
    .eq("organizer_id", organizer.id)
    .eq("credit_year", year)
    .maybeSingle<OrganizerPromotionCreditsRow>();

  if (existingError) {
    throw new Error(existingError.message);
  }
  if (existing) {
    return existing;
  }

  const includedTotal = includedForOrganizer(organizer);
  const { data: created, error: createError } = await supabase
    .from("organizer_promotion_credits")
    .insert({
      organizer_id: organizer.id,
      credit_year: year,
      included_total: includedTotal,
      used_total: 0,
    })
    .select("organizer_id,credit_year,included_total,used_total")
    .maybeSingle<OrganizerPromotionCreditsRow>();

  if (createError) {
    if (createError.code === "23505") {
      const { data: conflictExisting, error: conflictRefetchError } = await supabase
        .from("organizer_promotion_credits")
        .select("organizer_id,credit_year,included_total,used_total")
        .eq("organizer_id", organizer.id)
        .eq("credit_year", year)
        .maybeSingle<OrganizerPromotionCreditsRow>();
      if (conflictRefetchError || !conflictExisting) {
        throw new Error(conflictRefetchError?.message ?? "Failed to refetch organizer promotion credits row.");
      }
      return conflictExisting;
    }
    throw new Error(createError.message);
  }
  if (!created) {
    throw new Error("Failed to create organizer promotion credits row.");
  }
  return created;
}

export async function getRemainingPromotionCredits(
  supabase: SupabaseClient,
  organizer: OrganizerCreditRow,
  year: number,
): Promise<number> {
  if (!organizer.id) {
    throw new Error("Organizer id is required for promotion credit operations.");
  }
  const row = await getOrCreatePromotionCreditsRow(supabase, organizer, year);
  return Math.max(0, row.included_total - row.used_total);
}

export async function consumePromotionCredit(
  supabase: SupabaseClient,
  organizer: OrganizerCreditRow,
  year: number,
): Promise<boolean> {
  if (!organizer.id) {
    throw new Error("Organizer id is required for promotion credit operations.");
  }
  const row = await getOrCreatePromotionCreditsRow(supabase, organizer, year);
  if (row.used_total >= row.included_total) {
    return false;
  }

  const nextUsed = row.used_total + 1;
  const { data: updatedRows, error: updateError } = await supabase
    .from("organizer_promotion_credits")
    .update({ used_total: nextUsed, updated_at: new Date().toISOString() })
    .eq("organizer_id", organizer.id)
    .eq("credit_year", year)
    .eq("used_total", row.used_total)
    .select("organizer_id")
    .returns<Array<{ organizer_id: string }>>();

  if (updateError) {
    throw new Error(updateError.message);
  }
  return Boolean(updatedRows && updatedRows.length > 0);
}
