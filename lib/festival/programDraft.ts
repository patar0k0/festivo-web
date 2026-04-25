import type { SupabaseClient } from "@supabase/supabase-js";
import type { FestivalDay, FestivalScheduleItem } from "@/lib/types";
import {
  normalizeScheduleItemTimePair,
  parseHmInputToDbTime,
  sortByStartTime,
} from "@/lib/festival/festivalTimeFields";

export const PROGRAM_DRAFT_VERSION = 1;

export type ProgramDraftItem = {
  title: string;
  start_time?: string | null;
  end_time?: string | null;
  stage?: string | null;
  description?: string | null;
  sort_order?: number | null;
};

export type ProgramDraftDay = {
  date: string;
  title?: string | null;
  items: ProgramDraftItem[];
};

export type ProgramDraft = {
  version?: number;
  days: ProgramDraftDay[];
};

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

function trimStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Canonical empty draft for forms and API. */
export function emptyProgramDraft(): ProgramDraft {
  return { version: PROGRAM_DRAFT_VERSION, days: [] };
}

function normalizeItemRow(raw: unknown, sortIndex: number): ProgramDraftItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = trimStr(o.title);
  if (!title) return null;
  const startPair = normalizeScheduleItemTimePair(parseHmInputToDbTime(o.start_time), parseHmInputToDbTime(o.end_time));
  return {
    title,
    start_time: startPair.start_time,
    end_time: startPair.end_time,
    stage: trimStr(o.stage),
    description: trimStr(o.description),
    sort_order: typeof o.sort_order === "number" && Number.isFinite(o.sort_order) ? Math.trunc(o.sort_order) : sortIndex,
  };
}

function normalizeDayRow(raw: unknown): ProgramDraftDay | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const date = trimStr(o.date);
  if (!date || !isValidIsoDate(date)) return null;
  const itemsIn = Array.isArray(o.items) ? o.items : [];
  const items: ProgramDraftItem[] = [];
  itemsIn.forEach((it, idx) => {
    const row = normalizeItemRow(it, idx);
    if (row) items.push(row);
  });
  if (items.length > 0) {
    return {
      date,
      title: trimStr(o.title),
      items,
    };
  }
  const single = normalizeItemRow(o, 0);
  if (single) {
    return {
      date,
      title: trimStr(o.dayTitle ?? o.day_title),
      items: [single],
    };
  }
  return null;
}

/** Legacy: flat `items[]` (optional per-row `date`) or undated items under root `date`. */
function legacyFlatItemsToDays(
  itemsRaw: unknown[],
  rootDate: string | null,
  rootTitle: string | null,
): ProgramDraftDay[] {
  const dated = new Map<string, unknown[]>();
  const undated: unknown[] = [];
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const itemDate = trimStr((raw as Record<string, unknown>).date);
    if (itemDate && isValidIsoDate(itemDate)) {
      if (!dated.has(itemDate)) dated.set(itemDate, []);
      dated.get(itemDate)!.push(raw);
    } else {
      undated.push(raw);
    }
  }
  if (dated.size === 0 && undated.length > 0 && rootDate && isValidIsoDate(rootDate)) {
    const items: ProgramDraftItem[] = [];
    undated.forEach((it, idx) => {
      const row = normalizeItemRow(it, idx);
      if (row) items.push(row);
    });
    if (!items.length) return [];
    return [{ date: rootDate, title: rootTitle, items: sortProgramDraftItemsByStartTime(items) }];
  }
  const dates = [...dated.keys()].sort();
  return dates.map((d) => {
    const bucket = dated.get(d)!;
    const items: ProgramDraftItem[] = [];
    bucket.forEach((it, idx) => {
      const row = normalizeItemRow(it, idx);
      if (row) items.push(row);
    });
    return { date: d, title: null, items: sortProgramDraftItemsByStartTime(items) };
  });
}

/**
 * Parse and normalize program draft from JSON (pending `program_draft`, research payloads, API body).
 */
export function parseProgramDraftUnknown(input: unknown): { ok: true; value: ProgramDraft } | { ok: false; error: string } {
  if (input === null || input === undefined) {
    return { ok: true, value: emptyProgramDraft() };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "program_draft must be an object or null" };
  }
  const o = input as Record<string, unknown>;
  const version =
    typeof o.version === "number" && Number.isFinite(o.version) ? Math.trunc(o.version) : PROGRAM_DRAFT_VERSION;
  const daysIn = Array.isArray(o.days) ? o.days : null;
  if ((!daysIn || daysIn.length === 0) && Array.isArray(o.items) && o.items.length > 0) {
    const legacyDays = legacyFlatItemsToDays(o.items, trimStr(o.date), trimStr(o.title));
    if (legacyDays.length > 0) {
      const daysSorted = legacyDays.map((d) => ({ ...d, items: sortProgramDraftItemsByStartTime(d.items) }));
      return { ok: true, value: { version, days: daysSorted } };
    }
  }
  if (!daysIn) {
    return { ok: false, error: "program_draft.days must be an array" };
  }
  const days: ProgramDraftDay[] = [];
  for (const d of daysIn) {
    const day = normalizeDayRow(d);
    if (day) days.push({ ...day, items: sortProgramDraftItemsByStartTime(day.items) });
  }
  return { ok: true, value: { version, days } };
}

/** Strip empty days / items for storage. */
export function compactProgramDraft(draft: ProgramDraft): ProgramDraft {
  const days = draft.days
    .map((d) => {
      const items = d.items
        .map((it) => {
          const rawTitle = it.title?.trim() ?? "";
          const desc = it.description?.trim() ?? "";
          const fallbackTitle = desc ? desc.slice(0, 60) : "";
          const title = rawTitle || fallbackTitle;
          if (!title) return null;
          console.info("[program] normalized item", { rawTitle, fallbackTitle, finalTitle: title });
          return { ...it, title };
        })
        .filter((it): it is ProgramDraftItem => it !== null);
      return {
        date: d.date,
        title: d.title?.trim() ? d.title.trim() : null,
        items: sortProgramDraftItemsByStartTime(items),
      };
    })
    .filter((d) => isValidIsoDate(d.date));
  return { version: draft.version ?? PROGRAM_DRAFT_VERSION, days };
}

export function hasPublishableContent(draft: ProgramDraft | null): boolean {
  if (!draft?.days?.length) return false;

  for (const day of draft.days) {
    for (const item of day.items || []) {
      if (item.title && item.title.trim().length > 0) {
        return true;
      }
    }
  }

  return false;
}

export function programDraftHasContent(draft: ProgramDraft | null | undefined): boolean {
  if (!draft?.days?.length) return false;
  return hasPublishableContent(compactProgramDraft(draft));
}

/**
 * What we actually persist: compact strips empty titles, invalid dates, etc.
 * Use this (not raw `programDraftHasContent` alone) to decide the saved payload, client and server.
 */
export function programDraftToPublishPayload(draft: ProgramDraft | null | undefined): ProgramDraft | null {
  if (!draft?.days?.length) return null;
  const compacted = compactProgramDraft(draft);
  if (!hasPublishableContent(compacted)) {
    return null;
  }

  return compacted;
}

/** Build public detail schedule from stored JSON when `festival_schedule_items` are empty (e.g. RLS gaps). */
export function programDraftToDetailSchedule(draft: ProgramDraft, festivalId: string | number): {
  days: FestivalDay[];
  scheduleItems: FestivalScheduleItem[];
} {
  const c = programDraftToPublishPayload(draft);
  if (!c) return { days: [], scheduleItems: [] };
  const outDays: FestivalDay[] = [];
  const outItems: FestivalScheduleItem[] = [];
  for (const d of c.days) {
    const dateKey = d.date.slice(0, 10);
    const dayId = `pd-fb-${String(festivalId)}-${dateKey}`;
    outDays.push({
      id: dayId,
      festival_id: festivalId,
      date: d.date,
      title: d.title ?? null,
    });
    d.items.forEach((it, idx) => {
      outItems.push({
        id: `pd-fbi-${String(festivalId)}-${dateKey}-${idx}`,
        day_id: dayId,
        start_time: it.start_time ?? null,
        end_time: it.end_time ?? null,
        stage: it.stage ?? null,
        title: it.title,
        description: it.description ?? null,
        sort_order: it.sort_order ?? idx,
      });
    });
  }
  return { days: outDays, scheduleItems: outItems };
}

function cloneProgramDraft(d: ProgramDraft): ProgramDraft {
  return {
    version: d.version,
    days: d.days.map((day) => ({
      date: day.date,
      title: day.title ?? null,
      items: day.items.map((it) => ({ ...it })),
    })),
  };
}

function minutesSinceMidnightFromDbTime(hms: string | null | undefined): number | null {
  if (!hms || typeof hms !== "string") return null;
  const m = hms.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** Sort items for display and stable storage order (`start_time` lexicographic, then title). */
export function sortProgramDraftItemsByStartTime(items: ProgramDraftItem[]): ProgramDraftItem[] {
  return sortByStartTime(items);
}

/**
 * Merge multiple `ProgramDraftDay` rows that share the same ISO date (e.g. after row-first editing).
 * Invalid-date days are kept at the end for in-progress editing.
 */
export function mergeProgramDraftDaysByDate(draft: ProgramDraft): ProgramDraft {
  const validMap = new Map<string, { title: string | null; items: ProgramDraftItem[] }>();
  const invalidDays: ProgramDraftDay[] = [];

  for (const day of draft.days) {
    const d = day.date?.trim() ?? "";
    if (!d || !isValidIsoDate(d)) {
      invalidDays.push({
        date: day.date,
        title: day.title ?? null,
        items: sortProgramDraftItemsByStartTime(day.items.map((it) => ({ ...it }))),
      });
      continue;
    }
    const g = validMap.get(d) ?? { title: null, items: [] as ProgramDraftItem[] };
    if (!g.title && day.title) g.title = day.title;
    g.items.push(...day.items.map((it) => ({ ...it })));
    validMap.set(d, g);
  }

  const sortedDates = [...validMap.keys()].sort();
  const mergedValid: ProgramDraftDay[] = sortedDates.map((date) => {
    const g = validMap.get(date)!;
    return {
      date,
      title: g.title,
      items: sortProgramDraftItemsByStartTime(g.items),
    };
  });

  return {
    version: draft.version ?? PROGRAM_DRAFT_VERSION,
    days: [...mergedValid, ...invalidDays],
  };
}

/** One schedule row inside a day block (admin editor). */
export type ProgramEditorItemRow = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  stage: string | null;
  description: string | null;
};

/** Grouped day block for the admin program editor. */
export type ProgramEditorDayBlock = {
  id: string;
  date: string;
  dayTitle: string | null;
  items: ProgramEditorItemRow[];
};

export function programDraftToEditorDayBlocks(draft: ProgramDraft): ProgramEditorDayBlock[] {
  const merged = mergeProgramDraftDaysByDate(cloneProgramDraft(draft));
  return merged.days.map((day, di) => ({
    id: `day-${day.date}-${di}`,
    date: day.date,
    dayTitle: day.title ?? null,
    items: day.items.map((item, ii) => ({
      id: `day-${day.date}-${di}-item-${ii}`,
      title: item.title,
      start_time: item.start_time ?? null,
      end_time: item.end_time ?? null,
      stage: item.stage ?? null,
      description: item.description ?? null,
    })),
  }));
}

/** Merge blocks by date (preserves first-seen date order), sorts items per day. */
export function programDraftFromEditorDayBlocks(blocks: ProgramEditorDayBlock[]): ProgramDraft {
  const dateOrder: string[] = [];
  const itemsByDate = new Map<string, ProgramDraftItem[]>();
  const titleByDate = new Map<string, string | null>();

  for (const block of blocks) {
    const d = block.date.trim();
    if (!d || !isValidIsoDate(d)) continue;

    if (!itemsByDate.has(d)) {
      itemsByDate.set(d, []);
      dateOrder.push(d);
    }
    const dt = block.dayTitle?.trim() ? block.dayTitle.trim() : null;
    if (dt) titleByDate.set(d, dt);

    for (const row of block.items) {
      const rawTitle = row.title?.trim() ?? "";
      const desc = row.description?.trim() ? row.description.trim() : "";
      const fallbackTitle = desc ? desc.slice(0, 60) : "";
      const title = rawTitle || fallbackTitle;
      if (!title) continue;
      const pair = normalizeScheduleItemTimePair(
        parseHmInputToDbTime(row.start_time),
        parseHmInputToDbTime(row.end_time),
      );
      itemsByDate.get(d)!.push({
        title,
        start_time: pair.start_time,
        end_time: pair.end_time,
        stage: row.stage?.trim() ? row.stage.trim() : null,
        description: row.description?.trim() ? row.description.trim() : null,
        sort_order: null,
      });
    }
  }

  const days: ProgramDraftDay[] = dateOrder.map((date) => ({
    date,
    title: titleByDate.get(date) ?? null,
    items: sortProgramDraftItemsByStartTime(itemsByDate.get(date) ?? []),
  }));

  return { version: PROGRAM_DRAFT_VERSION, days };
}

/** Flat row model for the admin program editor (stable `id` for React state). */
export type ProgramEditorRow = {
  id: string;
  date: string;
  dayTitle: string | null;
  title: string;
  start_time: string | null;
  end_time: string | null;
  stage: string | null;
  description: string | null;
};

export function programDraftToEditorRows(draft: ProgramDraft): ProgramEditorRow[] {
  const rows: ProgramEditorRow[] = [];
  for (const b of programDraftToEditorDayBlocks(draft)) {
    b.items.forEach((item, ii) => {
      rows.push({
        id: item.id,
        date: b.date,
        dayTitle: ii === 0 ? b.dayTitle : null,
        title: item.title,
        start_time: item.start_time ?? null,
        end_time: item.end_time ?? null,
        stage: item.stage ?? null,
        description: item.description ?? null,
      });
    });
  }
  return rows;
}

export function compareProgramEditorRows(a: ProgramEditorRow, b: ProgramEditorRow): number {
  const ad = a.date.trim();
  const bd = b.date.trim();
  const aDateOk = ad.length > 0 && isValidIsoDate(ad);
  const bDateOk = bd.length > 0 && isValidIsoDate(bd);
  if (aDateOk && bDateOk && ad !== bd) return ad.localeCompare(bd);
  if (aDateOk !== bDateOk) return aDateOk ? -1 : 1;
  const as = minutesSinceMidnightFromDbTime(a.start_time);
  const bs = minutesSinceMidnightFromDbTime(b.start_time);
  const aOrd = as === null ? 24 * 60 : as;
  const bOrd = bs === null ? 24 * 60 : bs;
  if (aOrd !== bOrd) return aOrd - bOrd;
  return a.title.localeCompare(b.title);
}

/** Build a program draft from flat editor rows (merges duplicate dates, sorts items). */
export function programDraftFromEditorRows(rows: ProgramEditorRow[]): ProgramDraft {
  const sorted = [...rows].sort(compareProgramEditorRows);
  const blocks: ProgramEditorDayBlock[] = [];
  let cur: ProgramEditorDayBlock | null = null;

  for (const row of sorted) {
    const d = row.date.trim();
    if (!d || !isValidIsoDate(d)) continue;

    if (!cur || cur.date !== d) {
      cur = { id: `legacy-${d}-${blocks.length}`, date: d, dayTitle: null, items: [] };
      blocks.push(cur);
    }
    const dt = row.dayTitle?.trim() ? row.dayTitle.trim() : null;
    if (dt) cur.dayTitle = dt;
    cur.items.push({
      id: row.id,
      title: row.title,
      start_time: row.start_time,
      end_time: row.end_time,
      stage: row.stage,
      description: row.description,
    });
  }

  return programDraftFromEditorDayBlocks(blocks);
}

type GeminiProgramDay = {
  date?: string | null;
  title?: string | null;
  items?: unknown;
};

type GeminiProgramShape = {
  days?: GeminiProgramDay[] | null;
};

/** Build draft from Gemini / research `program` object (nullable fields). */
export function programDraftFromGeminiProgram(program: unknown): ProgramDraft | null {
  if (!program || typeof program !== "object" || Array.isArray(program)) return null;
  const daysRaw = (program as GeminiProgramShape).days;
  if (!Array.isArray(daysRaw) || daysRaw.length === 0) return null;
  const days: ProgramDraftDay[] = [];
  for (const d of daysRaw) {
    if (!d || typeof d !== "object") continue;
    const date = trimStr(d.date);
    if (!date || !isValidIsoDate(date)) continue;
    const itemsIn = Array.isArray(d.items) ? d.items : [];
    const items: ProgramDraftItem[] = [];
    itemsIn.forEach((it, idx) => {
      const row = normalizeItemRow(it, idx);
      if (row) items.push(row);
    });
    days.push({
      date,
      title: trimStr(d.title),
      items,
    });
  }
  if (!days.length) return null;
  return compactProgramDraft({ version: PROGRAM_DRAFT_VERSION, days });
}

export function publishedRowsToProgramDraft(
  days: Array<{ id: string; date: string; title?: string | null }>,
  items: Array<{
    day_id: string;
    title: string;
    start_time?: string | null;
    end_time?: string | null;
    stage?: string | null;
    description?: string | null;
    sort_order?: number | null;
  }>,
): ProgramDraft {
  const byDay = new Map<string, ProgramDraftItem[]>();
  for (const it of items) {
    const key = String(it.day_id);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push({
      title: it.title,
      start_time: it.start_time ?? null,
      end_time: it.end_time ?? null,
      stage: it.stage ?? null,
      description: it.description ?? null,
      sort_order: it.sort_order ?? null,
    });
  }
  const outDays: ProgramDraftDay[] = days.map((d) => ({
    date: d.date.slice(0, 10),
    title: d.title ?? null,
    items: byDay.get(String(d.id)) ?? [],
  }));
  return compactProgramDraft({ version: PROGRAM_DRAFT_VERSION, days: outDays });
}

/**
 * Replace all `festival_days` + `festival_schedule_items` for a festival from a draft.
 * Deletes existing schedule first; rolls back new day rows if item insert fails.
 */
export async function replaceFestivalScheduleFromProgramDraft(
  admin: SupabaseClient,
  festivalId: string,
  draft: ProgramDraft | null,
): Promise<void> {
  const { data: existingDays, error: loadErr } = await admin.from("festival_days").select("id").eq("festival_id", festivalId);
  if (loadErr) {
    throw new Error(`schedule load failed: ${loadErr.message}`);
  }
  const existingIds = (existingDays ?? []).map((r) => r.id as string);
  if (existingIds.length > 0) {
    const { error: delItemsErr } = await admin.from("festival_schedule_items").delete().in("day_id", existingIds);
    if (delItemsErr) {
      throw new Error(`schedule items delete failed: ${delItemsErr.message}`);
    }
    const { error: delDaysErr } = await admin.from("festival_days").delete().eq("festival_id", festivalId);
    if (delDaysErr) {
      throw new Error(`festival_days delete failed: ${delDaysErr.message}`);
    }
  }

  const compact = draft ? compactProgramDraft(draft) : emptyProgramDraft();
  if (!compact.days.length) {
    return;
  }

  const dayInserts = compact.days.map((d) => ({
    festival_id: festivalId,
    date: d.date,
    title: d.title?.trim() ? d.title.trim() : null,
  }));

  const { data: insertedDays, error: insDayErr } = await admin.from("festival_days").insert(dayInserts).select("id,date");
  if (insDayErr || !insertedDays || insertedDays.length !== compact.days.length) {
    throw new Error(`festival_days insert failed: ${insDayErr?.message ?? "missing rows"}`);
  }

  const itemRows: Array<{
    day_id: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
    stage: string | null;
    description: string | null;
    sort_order: number;
  }> = [];

  for (let i = 0; i < compact.days.length; i += 1) {
    const dayId = insertedDays[i]!.id as string;
    const day = compact.days[i]!;
    day.items.forEach((it, idx) => {
      itemRows.push({
        day_id: dayId,
        title: it.title,
        start_time: it.start_time ?? null,
        end_time: it.end_time ?? null,
        stage: it.stage ?? null,
        description: it.description ?? null,
        sort_order: it.sort_order ?? idx,
      });
    });
  }

  if (itemRows.length === 0) {
    const { error: delEmptyErr } = await admin.from("festival_days").delete().eq("festival_id", festivalId);
    if (delEmptyErr) {
      throw new Error(`festival_days delete (empty program) failed: ${delEmptyErr.message}`);
    }
    return;
  }

  const { error: insItemErr } = await admin.from("festival_schedule_items").insert(itemRows);
  if (insItemErr) {
    const newDayIds = insertedDays.map((r) => r.id as string);
    await admin.from("festival_days").delete().in("id", newDayIds);
    throw new Error(`festival_schedule_items insert failed: ${insItemErr.message}`);
  }
}
