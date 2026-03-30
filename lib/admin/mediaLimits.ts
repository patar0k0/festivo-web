import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveVip, type OrganizerVipStatusRow } from "@/lib/monetization";

export type MediaPlan = "free" | "vip";

export const MEDIA_LIMITS: Record<MediaPlan, { gallery: number; video: number }> = {
  free: { gallery: 3, video: 1 },
  vip: { gallery: 10, video: 2 },
};

/** Organizer row subset used for VIP window checks and media caps; missing/invalid plan → free via `hasActiveVip`. */
export type OrganizerPlanInput = OrganizerVipStatusRow | null | undefined;

export function resolveMediaPlanFromOrganizer(organizer: OrganizerPlanInput, nowDate: Date = new Date()): MediaPlan {
  // VIP is active only inside the plan window (matches existing monetization semantics).
  if (hasActiveVip(organizer, nowDate)) return "vip";
  return "free";
}

export function resolveAllowedMediaLimitsFromOrganizerPlan(
  organizer: OrganizerPlanInput,
  nowDate: Date = new Date(),
): { gallery: number; video: number } {
  const plan = resolveMediaPlanFromOrganizer(organizer, nowDate);
  return MEDIA_LIMITS[plan];
}

export function getMediaLimitExceededErrorMessage(params: {
  mediaType: "gallery" | "video";
  current: number;
  limit: number;
  plan: MediaPlan;
}) {
  const { mediaType, current, limit, plan } = params;
  const label = mediaType === "gallery" ? "images" : "videos";
  const action = mediaType === "gallery" ? "gallery" : "video";
  const base = `Media limit exceeded: ${label} ${current}/${limit} for ${plan} plan.`;
  const upgradeHint = plan === "free" ? ` Upgrade to VIP to increase ${action} limits.` : "";
  return base + upgradeHint;
}

type OrganizerPlanColumns = {
  plan: string | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
};

/** Loads plan columns for media limits; returns `data: null` when `primaryOrganizerId` is missing (treated as free tier). */
export async function fetchOrganizerPlanRow(supabase: SupabaseClient, primaryOrganizerId: string | null) {
  if (!primaryOrganizerId) {
    return { data: null, error: null };
  }
  const { data, error } = await supabase
    .from("organizers")
    .select("plan,plan_started_at,plan_expires_at")
    .eq("id", primaryOrganizerId)
    .maybeSingle<OrganizerPlanColumns>();
  return { data, error };
}
