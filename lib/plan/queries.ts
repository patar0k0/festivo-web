import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import type { MobilePlanStatsDto } from "@/lib/api/mobile/planSerialization";
import { logPlannerEvent } from "@/lib/plan/plannerLog";

/**
 * Single source of truth for planner table `.select(...)` strings (user-scoped reads).
 * Do not duplicate these literals in routes or helpers.
 */
export const PLANNER_TABLE_SELECT = {
  userPlanFestivals: {
    /** Saved festivals + `created_at` for snapshot `updated_at` aggregation. */
    snapshot: "festival_id,created_at",
    /** Festival id only (membership, counts, web reminder summary). */
    idsOnly: "festival_id",
  },
  userPlanItems: "schedule_item_id",
  userPlanReminders: "festival_id,reminder_type",
  /** Fields required for `getFestivalTemporalState` on saved festivals. */
  festivalsTemporal: "id,start_date,end_date,start_time,end_time,occurrence_dates",
  /** Minimal festival fields for mobile plan screen display. */
  festivalsBasic:
    "id,slug,title,start_date,end_date,image_url,category,is_verified,organizer_name,cities:cities!festivals_city_id_fkey(name_bg)",
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlannerPartialFailures = {
  festivals?: boolean;
  schedule_items?: boolean;
  reminders?: boolean;
  stats?: boolean;
};

export type NormalizedPlanFestivalRow = {
  festival_id: string;
  created_at: string | null;
};

export type NormalizedPlanItemRow = {
  schedule_item_id: string;
};

export type NormalizedPlanReminderRow = {
  festival_id: string;
  reminder_type: string | null;
};

export type FestivalTemporalPlanRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  occurrence_dates: string[] | null;
};

export type PlannerQuerySliceMeta = {
  errorMessage?: string;
};

function asStableId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s || null;
}

function normalizeFestivalSnapshotRow(raw: Record<string, unknown>): NormalizedPlanFestivalRow | null {
  const id = asStableId(raw.festival_id);
  if (!id) return null;
  const ca = raw.created_at;
  const created_at = typeof ca === "string" && ca.trim() ? ca : null;
  return { festival_id: id, created_at };
}

function normalizePlanItemRow(raw: Record<string, unknown>): NormalizedPlanItemRow | null {
  const id = asStableId(raw.schedule_item_id);
  if (!id) return null;
  return { schedule_item_id: id };
}

function normalizePlanReminderRow(raw: Record<string, unknown>): NormalizedPlanReminderRow | null {
  const id = asStableId(raw.festival_id);
  if (!id) return null;
  const rt = raw.reminder_type;
  return { festival_id: id, reminder_type: typeof rt === "string" ? rt : null };
}

/** Deterministic dedupe + lexicographic sort for stable list outputs. */
export function sortDedupedIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

export async function fetchSavedPlanFestivalsSnapshotForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ rows: NormalizedPlanFestivalRow[]; meta: PlannerQuerySliceMeta; rawRowCount: number }> {
  const { data, error } = await supabase
    .from("user_plan_festivals")
    .select(PLANNER_TABLE_SELECT.userPlanFestivals.snapshot)
    .eq("user_id", userId);

  if (error) {
    return { rows: [], meta: { errorMessage: error.message }, rawRowCount: 0 };
  }

  const rawRows = (data ?? []) as Record<string, unknown>[];
  const rows: NormalizedPlanFestivalRow[] = [];
  for (const r of rawRows) {
    const n = normalizeFestivalSnapshotRow(r);
    if (n) rows.push(n);
  }
  rows.sort((a, b) => a.festival_id.localeCompare(b.festival_id));
  return { rows, meta: {}, rawRowCount: rawRows.length };
}

/**
 * Saved festival ids only (`created_at` not selected). Rows are ordered by `festival_id`.
 */
export async function fetchSavedPlanFestivalIdsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ festivalIds: string[]; meta: PlannerQuerySliceMeta; rawRowCount: number }> {
  const { data, error } = await supabase
    .from("user_plan_festivals")
    .select(PLANNER_TABLE_SELECT.userPlanFestivals.idsOnly)
    .eq("user_id", userId);

  if (error) {
    return { festivalIds: [], meta: { errorMessage: error.message }, rawRowCount: 0 };
  }

  const rawRows = (data ?? []) as Record<string, unknown>[];
  const ids: string[] = [];
  for (const r of rawRows) {
    const id = asStableId(r.festival_id);
    if (id) ids.push(id);
  }
  return { festivalIds: sortDedupedIds(ids), meta: {}, rawRowCount: rawRows.length };
}

export async function fetchSavedPlanItemsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ rows: NormalizedPlanItemRow[]; meta: PlannerQuerySliceMeta; rawRowCount: number }> {
  const { data, error } = await supabase
    .from("user_plan_items")
    .select(PLANNER_TABLE_SELECT.userPlanItems)
    .eq("user_id", userId);

  if (error) {
    return { rows: [], meta: { errorMessage: error.message }, rawRowCount: 0 };
  }

  const rawRows = (data ?? []) as Record<string, unknown>[];
  const rows: NormalizedPlanItemRow[] = [];
  for (const r of rawRows) {
    const n = normalizePlanItemRow(r);
    if (n) rows.push(n);
  }
  rows.sort((a, b) => a.schedule_item_id.localeCompare(b.schedule_item_id));
  return { rows, meta: {}, rawRowCount: rawRows.length };
}

export async function fetchPlanRemindersForUser(
  supabase: SupabaseClient,
  userId: string,
  festivalIdFilter?: string[],
): Promise<{ rows: NormalizedPlanReminderRow[]; meta: PlannerQuerySliceMeta; rawRowCount: number }> {
  let q = supabase
    .from("user_plan_reminders")
    .select(PLANNER_TABLE_SELECT.userPlanReminders)
    .eq("user_id", userId);

  if (festivalIdFilter?.length) {
    q = q.in("festival_id", festivalIdFilter);
  }

  const { data, error } = await q;

  if (error) {
    return { rows: [], meta: { errorMessage: error.message }, rawRowCount: 0 };
  }

  const rawRows = (data ?? []) as Record<string, unknown>[];
  const rows: NormalizedPlanReminderRow[] = [];
  for (const r of rawRows) {
    const n = normalizePlanReminderRow(r);
    if (n) rows.push(n);
  }
  rows.sort((a, b) => {
    const c = a.festival_id.localeCompare(b.festival_id);
    if (c !== 0) return c;
    return String(a.reminder_type ?? "").localeCompare(String(b.reminder_type ?? ""));
  });
  return { rows, meta: {}, rawRowCount: rawRows.length };
}

export async function fetchFestivalTemporalRowsForPlanStats(
  supabase: SupabaseClient,
  festivalIds: string[],
): Promise<{ rows: FestivalTemporalPlanRow[]; meta: PlannerQuerySliceMeta }> {
  if (!festivalIds.length) {
    return { rows: [], meta: {} };
  }

  const { data, error } = await supabase
    .from("festivals")
    .select(PLANNER_TABLE_SELECT.festivalsTemporal)
    .in("id", festivalIds);

  if (error) {
    return { rows: [], meta: { errorMessage: error.message } };
  }

  const rawRows = (data ?? []) as Record<string, unknown>[];
  const rows: FestivalTemporalPlanRow[] = [];
  for (const r of rawRows) {
    const id = asStableId(r.id);
    if (!id) continue;
    const occ = r.occurrence_dates;
    rows.push({
      id,
      start_date: typeof r.start_date === "string" ? r.start_date : null,
      end_date: typeof r.end_date === "string" ? r.end_date : null,
      start_time: typeof r.start_time === "string" ? r.start_time : null,
      end_time: typeof r.end_time === "string" ? r.end_time : null,
      occurrence_dates: Array.isArray(occ) ? (occ as string[]) : null,
    });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { rows, meta: {} };
}

/**
 * Computes `upcomingCount` for saved festivals (upcoming + ongoing). On row-level parse errors,
 * skips the row. If `temporalMeta.errorMessage` is set, returns `upcomingCount: 0` and `failed: true`.
 */
export function computePlannerUpcomingCount(
  festivalRows: FestivalTemporalPlanRow[],
  temporalMeta: PlannerQuerySliceMeta,
): { upcomingCount: number; failed: boolean } {
  if (temporalMeta.errorMessage) {
    return { upcomingCount: 0, failed: true };
  }

  let upcomingCount = 0;
  for (const festival of festivalRows) {
    try {
      const state = getFestivalTemporalState(festival);
      if (state === "upcoming" || state === "ongoing") {
        upcomingCount += 1;
      }
    } catch {
      // skip bad row
    }
  }
  return { upcomingCount, failed: false };
}

export function buildPlannerStatsDto(args: {
  savedFestivalIds: string[];
  savedScheduleItemIds: string[];
  upcomingCount: number;
}): MobilePlanStatsDto {
  return {
    savedFestivalCount: Math.max(0, Number(args.savedFestivalIds.length)),
    plannedItemCount: Math.max(0, Number(args.savedScheduleItemIds.length)),
    upcomingCount: Math.max(0, Number(args.upcomingCount ?? 0)),
  };
}

export function collectSnapshotUpdatedAtCandidates(rows: NormalizedPlanFestivalRow[]): Array<string | null | undefined> {
  return rows.map((row) => row.created_at);
}

function asIsoString(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Same semantics as `computeSnapshotUpdatedAt` in planSerialization (kept local to avoid import cycles). */
export function aggregateSnapshotUpdatedAtIso(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .map((value) => asIsoString(value))
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

/**
 * Deterministic revision for stale-state protection (server-internal; not yet exposed on mobile).
 * Same logical plan snapshot ⇒ same revision string.
 */
export function deriveSnapshotRevision(args: {
  savedFestivalIdsSorted: string[];
  savedScheduleItemIdsSorted: string[];
  reminderKeysSorted: string[];
  stats: MobilePlanStatsDto;
  updatedAtIso: string | null;
}): string {
  const payload = JSON.stringify({
    v: 1,
    f: args.savedFestivalIdsSorted,
    i: args.savedScheduleItemIdsSorted,
    r: args.reminderKeysSorted,
    s: args.stats,
    u: args.updatedAtIso,
  });
  return `v1:${createHash("sha256").update(payload).digest("hex").slice(0, 24)}`;
}

export type SavedFestivalBasicRow = {
  id: string;
  slug: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  category: string | null;
  is_verified: boolean;
  organizer_name: string | null;
  cities: { name_bg: string | null }[] | { name_bg: string | null } | null;
};

export async function fetchSavedFestivalsBasicData(
  supabase: SupabaseClient,
  festivalIds: string[],
): Promise<{ rows: SavedFestivalBasicRow[]; meta: PlannerQuerySliceMeta }> {
  if (!festivalIds.length) return { rows: [], meta: {} };
  const { data, error } = await supabase
    .from("festivals")
    .select(PLANNER_TABLE_SELECT.festivalsBasic)
    .in("id", festivalIds)
    .order("start_date", { ascending: true });
  if (error) return { rows: [], meta: { errorMessage: error.message } };
  return { rows: (data ?? []) as SavedFestivalBasicRow[], meta: {} };
}

export type MobilePlannerBundle = {
  savedFestivalRows: NormalizedPlanFestivalRow[];
  savedFestivalIds: string[];
  savedFestivalBasicRows: SavedFestivalBasicRow[];
  savedScheduleItemIds: string[];
  reminderRows: NormalizedPlanReminderRow[];
  stats: MobilePlanStatsDto;
  updatedAtCandidates: Array<string | null | undefined>;
  partialFailures: PlannerPartialFailures;
  rowCounts: { festivals: number; items: number; reminders: number };
  degradedSlices: string[];
  /** Internal-only; log or future ETag — not sent to mobile yet. */
  snapshotRevision: string;
};

/**
 * Parallel planner reads + stats for mobile `/api/mobile/plan/state`.
 * Query-level failures degrade individual slices; they are not thrown.
 */
export async function loadMobilePlannerBundle(
  supabase: SupabaseClient,
  userId: string,
  logContext: { authed: boolean; startedAt: number },
): Promise<MobilePlannerBundle> {
  const partialFailures: PlannerPartialFailures = {};
  const degradedSlices: string[] = [];
  const elapsed = () => Math.max(0, Date.now() - logContext.startedAt);

  const [festRes, itemRes, remRes] = await Promise.all([
    fetchSavedPlanFestivalsSnapshotForUser(supabase, userId),
    fetchSavedPlanItemsForUser(supabase, userId),
    fetchPlanRemindersForUser(supabase, userId),
  ]);

  if (festRes.meta.errorMessage) {
    partialFailures.festivals = true;
    degradedSlices.push("festivals");
    logPlannerEvent({
      event: "planner_query_failed",
      authed: logContext.authed,
      duration_ms: elapsed(),
      table: "user_plan_festivals",
    });
  }
  if (itemRes.meta.errorMessage) {
    partialFailures.schedule_items = true;
    degradedSlices.push("schedule_items");
    logPlannerEvent({
      event: "planner_query_failed",
      authed: logContext.authed,
      duration_ms: elapsed(),
      table: "user_plan_items",
    });
  }
  if (remRes.meta.errorMessage) {
    partialFailures.reminders = true;
    degradedSlices.push("reminders");
    logPlannerEvent({
      event: "planner_query_failed",
      authed: logContext.authed,
      duration_ms: elapsed(),
      table: "user_plan_reminders",
    });
  }

  const savedFestivalRows = festRes.rows;
  const savedFestivalIds = sortDedupedIds(savedFestivalRows.map((r) => r.festival_id));
  const savedScheduleItemIds = sortDedupedIds(itemRes.rows.map((r) => r.schedule_item_id));

  const festivalIdsForTemporal = savedFestivalIds.filter((id) => UUID_RE.test(id));
  const [temporal, basicRes] = await Promise.all([
    fetchFestivalTemporalRowsForPlanStats(supabase, festivalIdsForTemporal),
    fetchSavedFestivalsBasicData(supabase, festivalIdsForTemporal),
  ]);

  if (temporal.meta.errorMessage) {
    logPlannerEvent({
      event: "planner_query_failed",
      authed: logContext.authed,
      duration_ms: elapsed(),
      table: "festivals_temporal",
    });
  }

  const { upcomingCount, failed: statsFailed } = computePlannerUpcomingCount(temporal.rows, temporal.meta);
  if (statsFailed) {
    partialFailures.stats = true;
    degradedSlices.push("stats");
    logPlannerEvent({
      event: "planner_stats_failed",
      authed: logContext.authed,
      duration_ms: elapsed(),
      slice: "upcoming_count",
      degraded: ["stats"],
    });
  }

  const stats = buildPlannerStatsDto({
    savedFestivalIds,
    savedScheduleItemIds,
    upcomingCount,
  });

  const updatedAtCandidates = collectSnapshotUpdatedAtCandidates(savedFestivalRows);

  const reminderRows = remRes.rows;
  const updatedAtIso = aggregateSnapshotUpdatedAtIso(updatedAtCandidates);

  const snapshotRevision = deriveSnapshotRevision({
    savedFestivalIdsSorted: savedFestivalIds,
    savedScheduleItemIdsSorted: savedScheduleItemIds,
    reminderKeysSorted: sortDedupedIds(reminderRows.map((r) => r.festival_id)),
    stats,
    updatedAtIso,
  });

  return {
    savedFestivalRows,
    savedFestivalIds,
    savedFestivalBasicRows: basicRes.rows,
    savedScheduleItemIds,
    reminderRows,
    stats,
    updatedAtCandidates,
    partialFailures,
    rowCounts: {
      festivals: festRes.rawRowCount,
      items: itemRes.rawRowCount,
      reminders: remRes.rawRowCount,
    },
    degradedSlices,
    snapshotRevision,
  };
}