import { type SupabaseClient, type User } from "@supabase/supabase-js";
import { festivalSettlementDisplayText } from "@/lib/settlements/formatDisplayName";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReminderType = "none" | "24h" | "same_day_09";

export type PlanState = {
  scheduleItemIds: string[];
  festivalIds: string[];
  reminders: Record<string, ReminderType>;
};

export type PlanEntry = {
  scheduleItemId: string;
  festivalId: string;
  festivalSlug: string;
  festivalTitle: string;
  city: string | null;
  dayDate: string | null;
  startTime: string | null;
  endTime: string | null;
  stage: string | null;
  title: string;
};

type UserPlanItemRow = {
  schedule_item_id: string | number;
};

type UserPlanReminderRow = {
  festival_id: string | number;
  reminder_type: ReminderType;
};

type UserPlanFestivalRow = {
  festival_id: string | number;
};

type FestivalDayRow = {
  id: string | number;
  festival_id: string | number;
  date: string | null;
};

type ScheduleItemRow = {
  id: string | number;
  day_id: string | number;
  start_time: string | null;
  end_time: string | null;
  stage: string | null;
  title: string;
  sort_order: number | null;
};

type CityJoinRow = { name_bg?: string | null; is_village?: boolean | null };

type FestivalRow = {
  id: string | number;
  slug: string;
  title: string;
  cities?: CityJoinRow | CityJoinRow[] | null;
};

function normalizePlanCityJoin(raw: CityJoinRow | CityJoinRow[] | null | undefined): CityJoinRow | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

async function getAuthedClientOrThrow(): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

export async function getPlanStateByUser(): Promise<PlanState> {
  let ctx: { supabase: SupabaseClient; user: User };
  try {
    ctx = await getAuthedClientOrThrow();
  } catch {
    return { scheduleItemIds: [], festivalIds: [], reminders: {} };
  }

  const [itemsResult, remindersResult, festivalsResult] = await Promise.all([
    ctx.supabase
      .from("user_plan_items")
      .select("schedule_item_id")
      .eq("user_id", ctx.user.id)
      .returns<UserPlanItemRow[]>(),
    ctx.supabase
      .from("user_plan_reminders")
      .select("festival_id,reminder_type")
      .eq("user_id", ctx.user.id)
      .returns<UserPlanReminderRow[]>(),
    ctx.supabase
      .from("user_plan_festivals")
      .select("festival_id")
      .eq("user_id", ctx.user.id)
      .returns<UserPlanFestivalRow[]>(),
  ]);

  const scheduleItemIds = (itemsResult.data ?? []).map((row) => String(row.schedule_item_id));
  const festivalIds = (festivalsResult.data ?? []).map((row) => String(row.festival_id));
  const reminders: Record<string, ReminderType> = {};

  (remindersResult.data ?? []).forEach((row) => {
    reminders[String(row.festival_id)] = row.reminder_type;
  });

  return { scheduleItemIds, festivalIds, reminders };
}

export async function getPrimaryScheduleItemByFestivalIds(
  festivalIds: Array<string | number>
): Promise<Record<string, string>> {
  if (!festivalIds.length) return {};

  const db = await createSupabaseServerClient();
  const normalizedFestivalIds = festivalIds.map((id) => String(id));

  const { data: dayRows } = await db
    .from("festival_days")
    .select("id,festival_id,date")
    .in("festival_id", normalizedFestivalIds)
    .order("date", { ascending: true })
    .returns<FestivalDayRow[]>();

  const days = dayRows ?? [];
  const dayIds = days.map((day) => String(day.id));
  if (!dayIds.length) return {};

  const { data: scheduleRows } = await db
    .from("festival_schedule_items")
    .select("id,day_id,start_time,sort_order")
    .in("day_id", dayIds)
    .order("start_time", { ascending: true })
    .order("sort_order", { ascending: true })
    .returns<Array<Pick<ScheduleItemRow, "id" | "day_id" | "start_time" | "sort_order">>>();

  const firstScheduleByDay = new Map<string, string>();
  (scheduleRows ?? []).forEach((item) => {
    const dayId = String(item.day_id);
    if (!firstScheduleByDay.has(dayId)) {
      firstScheduleByDay.set(dayId, String(item.id));
    }
  });

  const firstByFestival: Record<string, string> = {};
  days.forEach((day) => {
    const festivalId = String(day.festival_id);
    if (firstByFestival[festivalId]) return;

    const scheduleId = firstScheduleByDay.get(String(day.id));
    if (scheduleId) {
      firstByFestival[festivalId] = scheduleId;
    }
  });

  return firstByFestival;
}

export async function getPlanEntriesByUser(): Promise<PlanEntry[]> {
  let ctx: { supabase: SupabaseClient; user: User };
  try {
    ctx = await getAuthedClientOrThrow();
  } catch {
    return [];
  }

  const db = ctx.supabase;

  const { data: itemRows } = await db
    .from("user_plan_items")
    .select("schedule_item_id")
    .eq("user_id", ctx.user.id)
    .returns<UserPlanItemRow[]>();

  const scheduleIds = (itemRows ?? []).map((row) => String(row.schedule_item_id));
  if (!scheduleIds.length) return [];

  const { data: scheduleRows } = await db
    .from("festival_schedule_items")
    .select("id,day_id,start_time,end_time,stage,title,sort_order")
    .in("id", scheduleIds)
    .order("start_time", { ascending: true })
    .order("sort_order", { ascending: true })
    .returns<ScheduleItemRow[]>();

  const schedules = scheduleRows ?? [];
  const dayIds = Array.from(new Set(schedules.map((row) => String(row.day_id))));
  if (!dayIds.length) return [];

  const { data: dayRows } = await db
    .from("festival_days")
    .select("id,festival_id,date")
    .in("id", dayIds)
    .returns<FestivalDayRow[]>();

  const days = dayRows ?? [];
  const festivalIds = Array.from(new Set(days.map((day) => String(day.festival_id))));

  const { data: festivalRows } = await db
    .from("festivals")
    .select("id,slug,title,cities:cities!left(name_bg,is_village)")
    .in("id", festivalIds)
    .returns<FestivalRow[]>();

  const dayById = new Map(days.map((day) => [String(day.id), day]));
  const festivalById = new Map((festivalRows ?? []).map((festival) => [String(festival.id), festival]));

  const entries: PlanEntry[] = [];
  schedules.forEach((schedule) => {
    const day = dayById.get(String(schedule.day_id));
    if (!day) return;
    const festival = festivalById.get(String(day.festival_id));
    if (!festival) return;

    const joined = normalizePlanCityJoin(festival.cities);
    const cityLabel =
      joined?.name_bg?.trim() != null && joined.name_bg.trim() !== ""
        ? festivalSettlementDisplayText(joined.name_bg, joined.is_village ?? false)
        : null;
    entries.push({
      scheduleItemId: String(schedule.id),
      festivalId: String(festival.id),
      festivalSlug: festival.slug,
      festivalTitle: fixMojibakeBG(festival.title),
      city: cityLabel,
      dayDate: day.date,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      stage: schedule.stage,
      title: fixMojibakeBG(schedule.title),
    });
  });

  return entries;
}
