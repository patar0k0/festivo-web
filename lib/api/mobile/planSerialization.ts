import type { ReminderType } from "@/lib/plan/server";

type PlanReminderWireType = ReminderType;

export type MobilePlanReminderDto = {
  type: PlanReminderWireType;
  updated_at: string;
};

export type MobilePlanStatsDto = {
  savedFestivalCount: number;
  plannedItemCount: number;
  upcomingCount: number;
};

export type MobilePlanStateDto = {
  savedFestivalIds: string[];
  savedScheduleItemIds: string[];
  reminders: Record<string, MobilePlanReminderDto>;
  stats: MobilePlanStatsDto;
  updated_at: string;
};

function asIsoString(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeReminderType(raw: unknown): PlanReminderWireType {
  if (raw === "none" || raw === "24h" || raw === "same_day_09" || raw === "default") {
    return raw;
  }
  return "default";
}

export function normalizeReminderRecord(
  festivalId: string,
  reminderType: unknown,
  updatedAt: string | null | undefined,
): [string, MobilePlanReminderDto] {
  return [
    String(festivalId),
    {
      type: normalizeReminderType(reminderType),
      updated_at: asIsoString(updatedAt) ?? new Date(0).toISOString(),
    },
  ];
}

export function normalizeStableIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function normalizePlanStats(stats: Partial<MobilePlanStatsDto>): MobilePlanStatsDto {
  return {
    savedFestivalCount: Math.max(0, Number(stats.savedFestivalCount ?? 0)),
    plannedItemCount: Math.max(0, Number(stats.plannedItemCount ?? 0)),
    upcomingCount: Math.max(0, Number(stats.upcomingCount ?? 0)),
  };
}

export function computeSnapshotUpdatedAt(values: Array<string | null | undefined>): string {
  const timestamps = values
    .map((value) => asIsoString(value))
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) {
    return new Date(0).toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

export function buildMobilePlanSnapshot(args: {
  savedFestivalIds: string[];
  savedScheduleItemIds: string[];
  reminders: Record<string, MobilePlanReminderDto>;
  stats: Partial<MobilePlanStatsDto>;
  updatedAtCandidates: Array<string | null | undefined>;
}): MobilePlanStateDto {
  return {
    savedFestivalIds: normalizeStableIds(args.savedFestivalIds),
    savedScheduleItemIds: normalizeStableIds(args.savedScheduleItemIds),
    reminders: args.reminders,
    stats: normalizePlanStats(args.stats),
    updated_at: computeSnapshotUpdatedAt(args.updatedAtCandidates),
  };
}
