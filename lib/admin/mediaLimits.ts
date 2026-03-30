import { hasActiveVip } from "@/lib/monetization";

export type MediaPlan = "free" | "vip";

export const MEDIA_LIMITS: Record<MediaPlan, { gallery: number; video: number }> = {
  free: { gallery: 3, video: 1 },
  vip: { gallery: 10, video: 2 },
};

export type OrganizerPlanInfo = {
  plan?: MediaPlan | string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
} | null | undefined;

export function resolveMediaPlanFromOrganizer(organizer: OrganizerPlanInfo, nowDate: Date = new Date()): MediaPlan {
  // VIP is active only inside the plan window (matches existing monetization semantics).
  if (hasActiveVip(organizer as any, nowDate)) return "vip";
  return "free";
}

export function resolveAllowedMediaLimitsFromOrganizerPlan(organizer: OrganizerPlanInfo, nowDate: Date = new Date()) {
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

