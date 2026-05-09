import type { ReminderType } from "@/lib/plan/server";
import { aggregateSnapshotUpdatedAtIso, type SavedFestivalBasicRow } from "@/lib/plan/queries";

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

/** Optional: present only when one or more planner slices degraded (query-level). */
export type MobilePlanPartialFailures = {
  festivals?: boolean;
  schedule_items?: boolean;
  reminders?: boolean;
  stats?: boolean;
};

export type SavedFestivalBasicDto = {
  festivalId: string;
  slug: string;
  title: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  category: string | null;
  is_verified: boolean;
  organizer_name: string | null;
};

export type MobilePlanStateDto = {
  savedFestivalIds: string[];
  savedFestivals: SavedFestivalBasicDto[];
  savedScheduleItemIds: string[];
  reminders: Record<string, MobilePlanReminderDto>;
  stats: MobilePlanStatsDto;
  /** Max of known row timestamps; null when nothing to aggregate (mobile parser treats null like missing). */
  updated_at: string | null;
  partial_failures?: MobilePlanPartialFailures;
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
  festivalId: unknown,
  reminderType: unknown,
  updatedAt: string | null | undefined,
): [string, MobilePlanReminderDto] | null {
  const id = String(festivalId ?? "").trim();
  if (!id) return null;
  return [
    id,
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

export function computeSnapshotUpdatedAt(values: Array<string | null | undefined>): string | null {
  return aggregateSnapshotUpdatedAtIso(values);
}

function compactPartialFailures(p: MobilePlanPartialFailures): MobilePlanPartialFailures | undefined {
  const out: MobilePlanPartialFailures = {};
  if (p.festivals) out.festivals = true;
  if (p.schedule_items) out.schedule_items = true;
  if (p.reminders) out.reminders = true;
  if (p.stats) out.stats = true;
  return Object.keys(out).length ? out : undefined;
}

function normalizeSavedFestivals(rows: SavedFestivalBasicRow[]): SavedFestivalBasicDto[] {
  return rows.map((row) => ({
    festivalId: row.id,
    slug: row.slug,
    title: row.title,
    city: (Array.isArray(row.cities) ? row.cities[0]?.name_bg : row.cities?.name_bg) ?? null,
    start_date: row.start_date,
    end_date: row.end_date,
    image_url: row.image_url,
    category: row.category,
    is_verified: Boolean(row.is_verified),
    organizer_name: row.organizer_name,
  }));
}

export function buildMobilePlanSnapshot(args: {
  savedFestivalIds: string[];
  savedFestivalBasicRows: SavedFestivalBasicRow[];
  savedScheduleItemIds: string[];
  reminders: Record<string, MobilePlanReminderDto>;
  stats: Partial<MobilePlanStatsDto>;
  updatedAtCandidates: Array<string | null | undefined>;
  partialFailures?: MobilePlanPartialFailures;
}): MobilePlanStateDto {
  const partial = args.partialFailures ? compactPartialFailures(args.partialFailures) : undefined;
  const base: MobilePlanStateDto = {
    savedFestivalIds: normalizeStableIds(args.savedFestivalIds),
    savedFestivals: normalizeSavedFestivals(args.savedFestivalBasicRows),
    savedScheduleItemIds: normalizeStableIds(args.savedScheduleItemIds),
    reminders: args.reminders,
    stats: normalizePlanStats(args.stats),
    updated_at: computeSnapshotUpdatedAt(args.updatedAtCandidates),
  };
  if (partial) {
    base.partial_failures = partial;
  }
  return base;
}
