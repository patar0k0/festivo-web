import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildNewInCityPayload,
  buildReminderPayload,
  buildUpdatePayload,
  buildWeekendPayload,
  computeSavedFestivalReminderTimes,
  insertNotificationJobs,
  makeDedupeKey,
  type InsertJob,
} from "./scheduler";
import { formatSofiaDate, isSameSofiaCalendarDay } from "./time";
type FestivalRow = {
  id: string;
  title: string | null;
  slug: string;
  start_date: string | null;
  city: string | null;
  city_id: number | null;
  region: string | null;
  status: string | null;
};

const MEANINGFUL_KEYS = ["start_date", "end_date", "city", "city_id", "region", "address", "title", "occurrence_dates"] as const;

export function hasMeaningfulFestivalChange(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean {
  if (!before || !after) {
    return false;
  }

  for (const k of MEANINGFUL_KEYS) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      return true;
    }
  }

  return false;
}

export async function cancelPendingReminderJobs(userId: string, festivalId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();
  await supabase
    .from("notification_jobs")
    .update({ status: "cancelled", updated_at: now })
    .eq("user_id", userId)
    .eq("festival_id", festivalId)
    .eq("job_type", "reminder")
    .eq("status", "pending");
}

/** След записване на фестивал в плана: 24ч и 2ч преди начало (ако има start_date). */
export async function scheduleSavedFestivalReminders(
  userId: string,
  festivalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseAdmin();
  const { data: festival, error: fErr } = await supabase
    .from("festivals")
    .select("id,title,slug,start_date,status")
    .eq("id", festivalId)
    .maybeSingle();

  if (fErr || !festival) {
    return { ok: false, error: fErr?.message ?? "festival not found" };
  }

  if (festival.status === "archived") {
    return { ok: true };
  }

  const now = new Date();
  const times = computeSavedFestivalReminderTimes(festival.start_date, now);
  if (!times.length) {
    return { ok: true };
  }

  const rows = times.map((t) => {
    const payload = buildReminderPayload({
      slug: festival.slug,
      festivalId: festival.id,
      title: festival.title ?? "Фестивал",
      subkind: t.subkind,
    });
    const dedupe_key = makeDedupeKey([userId, "reminder", festival.id, t.scheduled_for.toISOString()]);
    return {
      user_id: userId,
      festival_id: festival.id,
      job_type: "reminder" as const,
      scheduled_for: t.scheduled_for.toISOString(),
      dedupe_key,
      payload_json: { ...payload, reminder_subkind: t.subkind },
    };
  });

  const { error } = await insertNotificationJobs(supabase, rows);
  if (error) {
    return { ok: false, error };
  }

  return { ok: true };
}

async function hasRecentUpdateSent(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  festivalId: string,
  withinMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - withinMs).toISOString();
  const { count, error } = await supabase
    .from("notification_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("festival_id", festivalId)
    .eq("job_type", "update")
    .eq("status", "sent")
    .gte("created_at", since);

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

/** Админ промяна на фестивал: уведомява само потребители със запис в плана. */
export async function scheduleFestivalUpdateNotifications(
  festivalId: string,
  beforeRow: Record<string, unknown> | null,
  afterRow: Record<string, unknown> | null,
): Promise<{ ok: boolean; scheduled?: number; error?: string }> {
  if (!beforeRow || !afterRow || !hasMeaningfulFestivalChange(beforeRow, afterRow)) {
    return { ok: true, scheduled: 0 };
  }

  const supabase = createSupabaseAdmin();
  const { data: savers, error: sErr } = await supabase
    .from("user_plan_festivals")
    .select("user_id")
    .eq("festival_id", festivalId);

  if (sErr) {
    return { ok: false, error: sErr.message };
  }

  const userIds = [...new Set((savers ?? []).map((r: { user_id: string }) => r.user_id))];
  if (!userIds.length) {
    return { ok: true, scheduled: 0 };
  }

  const { data: festival, error: fErr } = await supabase
    .from("festivals")
    .select("id,title,slug")
    .eq("id", festivalId)
    .maybeSingle();

  if (fErr || !festival) {
    return { ok: false, error: fErr?.message ?? "festival not found" };
  }

  const summary = "Променени са дата, място или друга важна информация.";
  const scheduledFor = new Date(Date.now() + 90_000).toISOString();
  const rows: InsertJob[] = [];

  for (const userId of userIds) {
    if (await hasRecentUpdateSent(supabase, userId, festivalId, 3600_000)) {
      continue;
    }

    await supabase
      .from("notification_jobs")
      .delete()
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("job_type", "update")
      .eq("status", "pending");

    const payload = buildUpdatePayload({
      slug: festival.slug,
      festivalId: festival.id,
      title: festival.title ?? "Фестивал",
      summary,
    });

    rows.push({
      user_id: userId,
      festival_id: festival.id,
      job_type: "update",
      scheduled_for: scheduledFor,
      dedupe_key: makeDedupeKey([userId, "update", festival.id, scheduledFor]),
      payload_json: payload,
    });
  }

  const { inserted, error } = await insertNotificationJobs(supabase, rows);
  if (error) {
    return { ok: false, error };
  }

  return { ok: true, scheduled: inserted };
}

function isFestivalGoodForNewNotification(f: FestivalRow): boolean {
  if (!f.slug?.trim() || f.slug.length < 2) {
    return false;
  }
  if (!f.title || f.title.trim().length < 3) {
    return false;
  }
  if (!f.start_date) {
    return false;
  }
  const start = new Date(f.start_date);
  if (Number.isNaN(start.getTime())) {
    return false;
  }
  return f.status !== "archived";
}

async function countNewFestivalToday(supabase: ReturnType<typeof createSupabaseAdmin>, userId: string): Promise<number> {
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("user_notifications")
    .select("created_at")
    .eq("user_id", userId)
    .eq("type", "new_festival")
    .gte("created_at", since);

  if (error || !data) {
    return 0;
  }

  const now = new Date();
  return data.filter((row: { created_at: string }) => isSameSofiaCalendarDay(new Date(row.created_at), now)).length;
}

/** След одобряване публикуване: последователи на град + дневен лимит + качество. */
export async function scheduleNewFestivalFollowCityJobs(
  festivalId: string,
): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  const { data: festival, error: fErr } = await supabase
    .from("festivals")
    .select("id,title,slug,city,city_id,region,start_date,status,category_slug,organizer_id")
    .eq("id", festivalId)
    .maybeSingle();

  if (fErr || !festival) {
    return { ok: false, error: fErr?.message ?? "festival not found" };
  }

  const f = festival as FestivalRow;
  if (!isFestivalGoodForNewNotification(f)) {
    return { ok: true, inserted: 0 };
  }

  let citySlug = f.city;
  if (!citySlug && f.city_id != null) {
    const { data: city } = await supabase.from("cities").select("slug").eq("id", f.city_id).maybeSingle<{ slug: string }>();
    citySlug = city?.slug ?? null;
  }

  if (!citySlug) {
    return { ok: true, inserted: 0 };
  }

  const { data: followers, error: folErr } = await supabase
    .from("user_followed_cities")
    .select("user_id")
    .eq("city_slug", citySlug);

  if (folErr) {
    return { ok: false, error: folErr.message };
  }

  const userIds = [...new Set((followers ?? []).map((r: { user_id: string }) => r.user_id))];
  if (!userIds.length) {
    return { ok: true, inserted: 0 };
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from("user_notification_settings")
    .select("user_id,notify_new_festivals_city,push_enabled")
    .in("user_id", userIds);

  if (settingsError) {
    return { ok: false, error: settingsError.message };
  }

  const settingsMap = new Map<string, { notify_new_festivals_city: boolean; push_enabled: boolean }>();
  for (const row of settingsRows ?? []) {
    const r = row as { user_id: string; notify_new_festivals_city: boolean; push_enabled: boolean } | null;
    if (r) {
      settingsMap.set(r.user_id, {
        notify_new_festivals_city: r.notify_new_festivals_city,
        push_enabled: r.push_enabled ?? true,
      });
    }
  }

  const cityLabel = citySlug.replace(/-/g, " ");
  const scheduledFor = new Date().toISOString();
  const rows: InsertJob[] = [];

  for (const userId of userIds) {
    const s = settingsMap.get(userId) ?? { notify_new_festivals_city: true, push_enabled: true };
    if (!s.notify_new_festivals_city || !s.push_enabled) {
      continue;
    }

    const todayCount = await countNewFestivalToday(supabase, userId);
    if (todayCount >= 1) {
      continue;
    }

    const payload = buildNewInCityPayload({
      slug: f.slug,
      festivalId: f.id,
      title: f.title ?? "Фестивал",
      cityLabel,
    });

    rows.push({
      user_id: userId,
      festival_id: f.id,
      job_type: "new_city",
      scheduled_for: scheduledFor,
      dedupe_key: makeDedupeKey([userId, "new_city", f.id, formatSofiaDate(new Date())]),
      payload_json: payload,
    });
  }

  const { inserted, error } = await insertNotificationJobs(supabase, rows);
  if (error) {
    return { ok: false, error };
  }

  return { ok: true, inserted };
}

export type WeekendRunSlot = "fri_18" | "sat_09";

/** Уикенд откриване: поне 2 фестивала в прозорец 2–3 дни, мач по град. */
export async function scheduleWeekendNearbyJobs(
  runSlot: WeekendRunSlot,
): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const to = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
  const fromIso = now.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);

  const { data: festRows, error: festErr } = await supabase
    .from("festivals")
    .select("id,title,slug,city,city_id,region,start_date,end_date,status")
    .neq("status", "archived")
    .gte("start_date", fromIso)
    .lte("start_date", toIso);

  if (festErr) {
    return { ok: false, error: festErr.message };
  }

  const festivals = (festRows ?? []) as FestivalRow[];
  if (festivals.length < 2) {
    return { ok: true, inserted: 0 };
  }

  const cityIds = [...new Set(festivals.map((f) => f.city_id).filter((id): id is number => id != null))];
  const citySlugById = new Map<number, string>();
  if (cityIds.length) {
    const { data: cityRows, error: cErr } = await supabase.from("cities").select("id,slug").in("id", cityIds);
    if (cErr) {
      return { ok: false, error: cErr.message };
    }
    for (const c of cityRows ?? []) {
      const row = c as { id: number; slug: string };
      citySlugById.set(row.id, row.slug);
    }
  }

  const { data: digestUsers, error: duErr } = await supabase
    .from("user_notification_settings")
    .select("user_id,notify_weekend_digest,only_saved,push_enabled,region_slugs")
    .eq("notify_weekend_digest", true)
    .eq("only_saved", false);

  if (duErr) {
    return { ok: false, error: duErr.message };
  }

  const candidates = (digestUsers ?? []).filter(
    (r: { push_enabled?: boolean }) => r.push_enabled !== false,
  ) as { user_id: string; region_slugs: string[] | null }[];

  if (!candidates.length) {
    return { ok: true, inserted: 0 };
  }

  const { data: allFollows, error: flErr } = await supabase.from("user_followed_cities").select("user_id,city_slug");

  if (flErr) {
    return { ok: false, error: flErr.message };
  }

  const followsByUser = new Map<string, Set<string>>();
  for (const row of allFollows ?? []) {
    const r = row as { user_id: string; city_slug: string };
    if (!followsByUser.has(r.user_id)) {
      followsByUser.set(r.user_id, new Set());
    }
    followsByUser.get(r.user_id)?.add(r.city_slug);
  }

  const slotKey = `${formatSofiaDate(now)}_${runSlot}`;
  const rows: InsertJob[] = [];

  for (const u of candidates) {
    const userId = u.user_id;
    const follows = followsByUser.get(userId);
    const regions = new Set((u.region_slugs ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean));

    if (!follows?.size && !regions.size) {
      continue;
    }

    const matched: FestivalRow[] = [];

    for (const fest of festivals) {
      let slug = fest.city?.trim() || null;
      if (!slug && fest.city_id != null) {
        slug = citySlugById.get(fest.city_id) ?? null;
      }

      if (slug && follows?.has(slug)) {
        matched.push(fest);
        continue;
      }

      if (fest.region && regions.has(fest.region.trim().toLowerCase())) {
        matched.push(fest);
      }
    }

    if (matched.length < 2) {
      continue;
    }

    matched.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
    const primary = matched[0];
    if (!primary) {
      continue;
    }

    const extra = matched.length - 1;
    const body =
      extra > 0
        ? `${primary.title ?? "Фестивал"} и още ${extra} наблизо този уикенд.`
        : `${primary.title ?? "Фестивал"} този уикенд.`;

    const payload = buildWeekendPayload({
      slug: primary.slug,
      festivalId: primary.id,
      title: "Уикенд наблизо",
      body,
    });

    const scheduledFor = new Date().toISOString();
    rows.push({
      user_id: userId,
      festival_id: primary.id,
      job_type: "weekend",
      scheduled_for: scheduledFor,
      dedupe_key: makeDedupeKey([userId, "weekend", slotKey]),
      payload_json: { ...payload, festival_count: matched.length },
    });
  }

  const { inserted, error } = await insertNotificationJobs(supabase, rows);
  if (error) {
    return { ok: false, error };
  }

  return { ok: true, inserted };
}
