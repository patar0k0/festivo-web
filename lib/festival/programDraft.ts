import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFestivalTimePair, parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";

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
  const startPair = normalizeFestivalTimePair(parseHmInputToDbTime(o.start_time), parseHmInputToDbTime(o.end_time));
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
  return {
    date,
    title: trimStr(o.title),
    items,
  };
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
  const daysIn = Array.isArray(o.days) ? o.days : null;
  if (!daysIn) {
    return { ok: false, error: "program_draft.days must be an array" };
  }
  const days: ProgramDraftDay[] = [];
  for (const d of daysIn) {
    const day = normalizeDayRow(d);
    if (day) days.push(day);
  }
  const version =
    typeof o.version === "number" && Number.isFinite(o.version) ? Math.trunc(o.version) : PROGRAM_DRAFT_VERSION;
  return { ok: true, value: { version, days } };
}

/** Strip empty days / items for storage. */
export function compactProgramDraft(draft: ProgramDraft): ProgramDraft {
  const days = draft.days
    .map((d) => ({
      date: d.date,
      title: d.title?.trim() ? d.title.trim() : null,
      items: d.items.filter((it) => it.title.trim().length > 0),
    }))
    .filter((d) => isValidIsoDate(d.date));
  return { version: draft.version ?? PROGRAM_DRAFT_VERSION, days };
}

export function programDraftHasContent(draft: ProgramDraft | null | undefined): boolean {
  if (!draft?.days?.length) return false;
  return draft.days.some((d) => d.items.length > 0);
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
    return;
  }

  const { error: insItemErr } = await admin.from("festival_schedule_items").insert(itemRows);
  if (insItemErr) {
    const newDayIds = insertedDays.map((r) => r.id as string);
    await admin.from("festival_days").delete().in("id", newDayIds);
    throw new Error(`festival_schedule_items insert failed: ${insItemErr.message}`);
  }
}
