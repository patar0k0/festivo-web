import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasRecentWindowDuplicate } from "./dedupe";
import {
  buildFollowedOrganizerPayload,
  buildNewInCityPayload,
  buildReminderPayload,
  buildTrendingPayload,
  buildUpdatePayload,
  buildWeekendPayload,
  computeSavedFestivalReminderTimes,
  insertNotificationJobs,
  makeDedupeKey,
  type InsertJob,
} from "./scheduler";
import { getUsersNotificationRates24hBatch, shouldSkipScheduleForRateLimit } from "./rateLimit";
import { formatSofiaDate, getFestivalStartInstant, isSameSofiaCalendarDay } from "./time";
import type { ReminderType } from "@/lib/plan/server";

type FestivalRow = {
  id: string;
  title: string | null;
  slug: string;
  start_date: string | null;
  end_date?: string | null;
  city_id: number | null;
  category_slug?: string | null;
  organizer_id?: string | null;
  saves_count?: number | null;
  promotion_status?: string | null;
  status: string | null;
};

function normStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** ISO date-only prefix for comparison */
function dateKey(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * True only for meaningful public-facing changes (dates, location, cancel).
 * Ignores description, images, tags, minor metadata.
 */
export function shouldNotifyUpdate(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean {
  if (!before || !after) {
    return false;
  }

  if (dateKey(before.start_date) !== dateKey(after.start_date)) {
    return true;
  }

  if (normStr(before.start_time) !== normStr(after.start_time)) {
    return true;
  }

  if (normStr(before.end_time) !== normStr(after.end_time)) {
    return true;
  }

  if (endDateChangedSignificantly(before.end_date, after.end_date)) {
    return true;
  }

  if (normStr(before.city_id) !== normStr(after.city_id)) {
    return true;
  }

  if (normStr(before.address) !== normStr(after.address)) {
    return true;
  }

  const stB = normStr(before.status);
  const stA = normStr(after.status);
  if (stA === "archived" && stB !== "archived") {
    return true;
  }
  if (stA === "archived" || stB === "archived") {
    return stA !== stB;
  }

  return false;
}

function endDateChangedSignificantly(before: unknown, after: unknown): boolean {
  const b = before == null ? null : before;
  const a = after == null ? null : after;
  if (b === null && a === null) {
    return false;
  }
  if (b === null || a === null) {
    return true;
  }
  const sa = dateKey(b);
  const sb = dateKey(a);
  if (!sa && !sb) {
    return false;
  }
  if (!sa || !sb) {
    return true;
  }
  if (sa === sb) {
    return false;
  }

  const da = new Date(`${sa}T12:00:00`);
  const db = new Date(`${sb}T12:00:00`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) {
    return true;
  }

  const diffDays = Math.abs(da.getTime() - db.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays >= 1;
}

/** @deprecated Use shouldNotifyUpdate */
export function hasMeaningfulFestivalChange(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean {
  return shouldNotifyUpdate(before, after);
}

export async function cancelPendingReminderJobs(userId: string, festivalId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { count, error: countErr } = await supabase
    .from("notification_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("festival_id", festivalId)
    .eq("job_type", "reminder")
    .eq("status", "pending");

  if (countErr) {
    console.warn("[REMINDER DELETE] count failed", { userId, festivalId, message: countErr.message });
  } else {
    console.info("[REMINDER DELETE]", { userId, festivalId, pendingCount: count ?? 0 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("notification_jobs")
    .update({ status: "cancelled", updated_at: now })
    .eq("user_id", userId)
    .eq("festival_id", festivalId)
    .eq("job_type", "reminder")
    .eq("status", "pending");
}

/**
 * Schedules pending reminder jobs for a saved festival: **24h before** and **2h before** start
 * (all future slots). `24h` / `same_day_09` / `default` are equivalent here — preference is expressed
 * only as saved vs not (`none`).
 */
export async function scheduleSavedFestivalReminders(
  userId: string,
  festivalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseAdmin();
  const { data: festival, error: fErr } = await supabase
    .from("festivals")
    .select("id,title,slug,city,start_date,start_time,status")
    .eq("id", festivalId)
    .maybeSingle();

  if (fErr || !festival) {
    return { ok: false, error: fErr?.message ?? "festival not found" };
  }

  if (festival.status === "archived") {
    return { ok: true };
  }

  const now = new Date();
  const startInstant = getFestivalStartInstant(
    festival.start_date,
    (festival as { start_time?: string | null }).start_time ?? null,
  );
  const times = computeSavedFestivalReminderTimes(
    festival.start_date,
    now,
    (festival as { start_time?: string | null }).start_time ?? null,
  );

  if (!times.length || !startInstant) {
    return { ok: true };
  }

  const festivalMeta = {
    id: festival.id,
    slug: festival.slug,
    title: festival.title,
    city: (festival as { city?: string | null }).city ?? null,
  };

  const rows = times.map((t) => {
    const payload = buildReminderPayload({
      festival: festivalMeta,
      subkind: t.subkind,
      festivalStartAt: startInstant,
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

/**
 * Single entry point for saved-festival push reminders (`notification_jobs` only).
 * - `none`: cancel all pending reminder jobs for this user/festival
 * - otherwise: delete pending (cancel) then upsert fresh 24h + 2h jobs (dedupe_key + ignoreDuplicates)
 */
export async function syncReminderJobsForPreference(
  userId: string,
  festivalId: string,
  reminderType: ReminderType,
): Promise<{ ok: boolean; error?: string }> {
  console.info("[REMINDER SYNC]", { userId, festivalId, reminderType });
  await cancelPendingReminderJobs(userId, festivalId);
  if (reminderType === "none") {
    return { ok: true };
  }
  return scheduleSavedFestivalReminders(userId, festivalId);
}

/** Админ промяна на фестивал: уведомява само потребители със запис в плана. */
export async function scheduleFestivalUpdateNotifications(
  festivalId: string,
  beforeRow: Record<string, unknown> | null,
  afterRow: Record<string, unknown> | null,
): Promise<{ ok: boolean; scheduled?: number; error?: string }> {
  if (!beforeRow || !afterRow || !shouldNotifyUpdate(beforeRow, afterRow)) {
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
  const ratesMap = await getUsersNotificationRates24hBatch(supabase, userIds);
  const rows: InsertJob[] = [];

  for (const userId of userIds) {
    const rates = ratesMap.get(userId) ?? { totalSent: 0, promoSent: 0 };
    if (shouldSkipScheduleForRateLimit("update", rates)) {
      continue;
    }

    if (await hasRecentWindowDuplicate(supabase, { user_id: userId, festival_id: festivalId, job_type: "update" })) {
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

  const { inserted, error } = await insertNotificationJobs(supabase, rows, { skipSafetyChecks: true });
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

function normalizeCityLabelFromSlug(citySlug: string | null): string | null {
  if (!citySlug) return null;
  return citySlug
    .split("-")
    .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
    .join(" ")
    .trim();
}

function safeDateMs(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function trendingScore(festival: FestivalRow, nowMs: number, proximityBoost: number): number {
  const startMs = safeDateMs(festival.start_date);
  if (startMs == null) return -999;
  const daysToStart = Math.floor((startMs - nowMs) / (24 * 60 * 60 * 1000));
  if (daysToStart < 0) return -999;
  const freshnessDecay = Math.max(0, 34 - daysToStart * 3);
  const saveScore = Math.min(28, Math.max(0, Number(festival.saves_count ?? 0) * 0.8));
  const promotedBoost = festival.promotion_status === "promoted" ? 10 : 0;
  return freshnessDecay + saveScore + promotedBoost + proximityBoost;
}

/** След одобряване публикуване: последователи на град + дневен лимит + качество. */
export async function scheduleNewFestivalFollowCityJobs(
  festivalId: string,
): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  const { data: festival, error: fErr } = await supabase
    .from("festivals")
    .select("id,title,slug,city_id,start_date,status,category_slug,organizer_id")
    .eq("id", festivalId)
    .maybeSingle();

  if (fErr || !festival) {
    return { ok: false, error: fErr?.message ?? "festival not found" };
  }

  const f = festival as FestivalRow;
  if (!isFestivalGoodForNewNotification(f)) {
    return { ok: true, inserted: 0 };
  }

  let citySlug: string | null = null;
  if (f.city_id != null) {
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

/** After approval: notify users following any organizer linked to the new festival. */
export async function scheduleFollowedOrganizerFestivalJobs(
  festivalId: string,
): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  const { data: festival, error: fErr } = await supabase
    .from("festivals")
    .select("id,title,slug,organizer_id,status")
    .eq("id", festivalId)
    .maybeSingle();
  if (fErr || !festival) {
    return { ok: false, error: fErr?.message ?? "festival not found" };
  }
  if (festival.status === "archived") {
    return { ok: true, inserted: 0 };
  }

  const organizerIds = new Set<string>();
  if ((festival as { organizer_id?: string | null }).organizer_id) {
    organizerIds.add((festival as { organizer_id: string }).organizer_id);
  }
  const { data: links, error: linksError } = await supabase
    .from("festival_organizers")
    .select("organizer_id")
    .eq("festival_id", festival.id);
  if (linksError) {
    return { ok: false, error: linksError.message };
  }
  for (const link of links ?? []) {
    const organizerId = (link as { organizer_id?: string | null }).organizer_id;
    if (organizerId) organizerIds.add(organizerId);
  }
  if (!organizerIds.size) {
    return { ok: true, inserted: 0 };
  }

  const { data: organizerRows, error: orgErr } = await supabase
    .from("organizers")
    .select("id,name")
    .in("id", [...organizerIds]);
  if (orgErr) {
    return { ok: false, error: orgErr.message };
  }
  const organizerNameById = new Map<string, string>();
  for (const row of organizerRows ?? []) {
    const r = row as { id: string; name: string | null };
    organizerNameById.set(r.id, r.name?.trim() || "организатор, който следваш");
  }

  const { data: followers, error: folErr } = await supabase
    .from("user_followed_organizers")
    .select("user_id,organizer_id")
    .in("organizer_id", [...organizerIds]);
  if (folErr) {
    return { ok: false, error: folErr.message };
  }
  if (!followers?.length) {
    return { ok: true, inserted: 0 };
  }

  const userToOrganizer = new Map<string, string>();
  for (const row of followers) {
    const r = row as { user_id: string; organizer_id: string };
    if (!userToOrganizer.has(r.user_id)) {
      userToOrganizer.set(r.user_id, r.organizer_id);
    }
  }
  const userIds = [...userToOrganizer.keys()];
  const { data: settingsRows, error: setErr } = await supabase
    .from("user_notification_settings")
    .select("user_id,push_enabled,notify_followed_organizers")
    .in("user_id", userIds);
  if (setErr) {
    return { ok: false, error: setErr.message };
  }
  const settingsMap = new Map<string, { push_enabled: boolean; notify_followed_organizers: boolean }>();
  for (const row of settingsRows ?? []) {
    const r = row as { user_id: string; push_enabled: boolean; notify_followed_organizers: boolean };
    settingsMap.set(r.user_id, {
      push_enabled: r.push_enabled ?? true,
      notify_followed_organizers: r.notify_followed_organizers ?? true,
    });
  }

  const scheduledFor = new Date().toISOString();
  const rows: InsertJob[] = [];
  for (const userId of userIds) {
    const settings = settingsMap.get(userId) ?? { push_enabled: true, notify_followed_organizers: true };
    if (!settings.push_enabled || !settings.notify_followed_organizers) continue;
    const organizerId = userToOrganizer.get(userId);
    if (!organizerId) continue;
    rows.push({
      user_id: userId,
      festival_id: festival.id,
      job_type: "followed_organizer",
      scheduled_for: scheduledFor,
      dedupe_key: makeDedupeKey([userId, "followed_organizer", festival.id]),
      payload_json: buildFollowedOrganizerPayload({
        slug: festival.slug,
        festivalId: festival.id,
        festivalTitle: festival.title?.trim() || "Нов фестивал",
        organizerName: organizerNameById.get(organizerId) ?? "организатор, който следваш",
        organizerId,
      }),
    });
  }

  const { inserted, error } = await insertNotificationJobs(supabase, rows);
  if (error) return { ok: false, error };
  return { ok: true, inserted };
}

export type WeekendRunSlot = "fri_18" | "sat_09";

/** Nearby discovery: followed cities + saved profile city; lightweight and weekend-focused. */
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
    .select("id,title,slug,city_id,start_date,end_date,status")
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
    .select("user_id,notify_weekend_digest,notify_nearby_discovery,only_saved,push_enabled")
    .eq("notify_weekend_digest", true)
    .eq("only_saved", false);

  if (duErr) {
    return { ok: false, error: duErr.message };
  }

  const candidates = (digestUsers ?? []).filter(
    (r: { push_enabled?: boolean }) => r.push_enabled !== false,
  ) as { user_id: string }[];
  const nearbyEnabledByUser = new Map<string, boolean>();
  for (const row of digestUsers ?? []) {
    const r = row as { user_id: string; notify_nearby_discovery?: boolean };
    nearbyEnabledByUser.set(r.user_id, r.notify_nearby_discovery !== false);
  }

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

  const { data: profileCities, error: profileErr } = await supabase
    .from("profiles")
    .select("user_id,city_id")
    .in(
      "user_id",
      candidates.map((c) => c.user_id),
    );
  if (profileErr) {
    console.warn("[notifications] profile city fallback unavailable", profileErr.message);
  }
  const profileCityByUser = new Map<string, string>();
  const profileCityIds = [...new Set((profileCities ?? []).map((r) => (r as { city_id?: number | null }).city_id).filter((v): v is number => v != null))];
  const profileCitySlugById = new Map<number, string>();
  if (profileCityIds.length) {
    const { data: cityRows, error: cityErr } = await supabase.from("cities").select("id,slug").in("id", profileCityIds);
    if (cityErr) {
      return { ok: false, error: cityErr.message };
    }
    for (const row of cityRows ?? []) {
      const r = row as { id: number; slug: string };
      profileCitySlugById.set(r.id, r.slug);
    }
  }
  for (const row of profileCities ?? []) {
    const r = row as { user_id: string; city_id: number | null };
    if (r.city_id == null) continue;
    const slug = profileCitySlugById.get(r.city_id);
    if (slug) profileCityByUser.set(r.user_id, slug);
  }

  const slotKey = `${formatSofiaDate(now)}_${runSlot}`;
  const rows: InsertJob[] = [];

  for (const u of candidates) {
    const userId = u.user_id;
    if (nearbyEnabledByUser.get(userId) === false) {
      continue;
    }
    const follows = new Set(followsByUser.get(userId) ?? []);
    const profileCitySlug = profileCityByUser.get(userId);
    if (profileCitySlug) {
      follows.add(profileCitySlug);
    }
    if (!follows.size) {
      continue;
    }

    const matched: FestivalRow[] = [];

    for (const fest of festivals) {
      const slug = fest.city_id != null ? citySlugById.get(fest.city_id) ?? null : null;

      if (slug && follows.has(slug)) {
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
    const citySlug = primary.city_id != null ? citySlugById.get(primary.city_id) ?? null : null;
    const cityLabel = normalizeCityLabelFromSlug(citySlug);
    const body =
      extra > 0
        ? `Този уикенд${cityLabel ? ` във ${cityLabel}` : ""}: ${primary.title ?? "фестивал"} и още ${extra} наблизо.`
        : `Този уикенд${cityLabel ? ` във ${cityLabel}` : ""}: ${primary.title ?? "фестивал"}.`;

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

/** Weekly trending picks per user (one candidate, regional-first ranking). */
export async function scheduleWeeklyTrendingJobs(): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const fromIso = now.toISOString().slice(0, 10);
  const toIso = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [{ data: festivals, error: festErr }, { data: settingsRows, error: settingsErr }, { data: follows, error: followsErr }] =
    await Promise.all([
      supabase
        .from("festivals")
        .select("id,title,slug,start_date,end_date,city_id,status,promotion_status,organizer_id")
        .neq("status", "archived")
        .gte("start_date", fromIso)
        .lte("start_date", toIso)
        .limit(250),
      supabase
        .from("user_notification_settings")
        .select("user_id,push_enabled,notify_trending_alerts")
        .eq("notify_trending_alerts", true),
      supabase.from("user_followed_cities").select("user_id,city_slug"),
    ]);

  if (festErr) return { ok: false, error: festErr.message };
  if (settingsErr) return { ok: false, error: settingsErr.message };
  if (followsErr) return { ok: false, error: followsErr.message };
  if (!festivals?.length || !settingsRows?.length) return { ok: true, inserted: 0 };

  const cityIds = [...new Set((festivals as FestivalRow[]).map((f) => f.city_id).filter((id): id is number => id != null))];
  const festivalIds = (festivals as FestivalRow[]).map((f) => f.id);
  const organizerIds = [
    ...new Set(
      (festivals as (FestivalRow & { organizer_id?: string | null })[])
        .map((f) => f.organizer_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const citySlugById = new Map<number, string>();
  if (cityIds.length) {
    const { data: cityRows, error: cityErr } = await supabase.from("cities").select("id,slug").in("id", cityIds);
    if (cityErr) return { ok: false, error: cityErr.message };
    for (const cityRow of cityRows ?? []) {
      const c = cityRow as { id: number; slug: string };
      citySlugById.set(c.id, c.slug);
    }
  }
  const savesByFestival = new Map<string, number>();
  const saveVelocityByFestival = new Map<string, number>();
  if (festivalIds.length) {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: savesRows, error: savesErr }, { data: velocityRows, error: velocityErr }] = await Promise.all([
      supabase
      .from("user_plan_festivals")
      .select("festival_id")
      .in("festival_id", festivalIds),
      supabase
        .from("user_plan_festivals")
        .select("festival_id,created_at")
        .in("festival_id", festivalIds)
        .gte("created_at", weekAgo),
    ]);
    if (savesErr) return { ok: false, error: savesErr.message };
    if (velocityErr) return { ok: false, error: velocityErr.message };
    for (const row of savesRows ?? []) {
      const festivalId = (row as { festival_id: string }).festival_id;
      savesByFestival.set(festivalId, (savesByFestival.get(festivalId) ?? 0) + 1);
    }
    for (const row of velocityRows ?? []) {
      const festivalId = (row as { festival_id: string }).festival_id;
      saveVelocityByFestival.set(festivalId, (saveVelocityByFestival.get(festivalId) ?? 0) + 1);
    }
  }

  const followerCountByOrganizer = new Map<string, number>();
  const verifiedOrganizer = new Set<string>();
  if (organizerIds.length) {
    const [{ data: followRows, error: followErr }, { data: orgRows, error: orgErr }] = await Promise.all([
      supabase.from("user_followed_organizers").select("organizer_id").in("organizer_id", organizerIds),
      supabase.from("organizers").select("id,verified").in("id", organizerIds),
    ]);
    if (followErr) return { ok: false, error: followErr.message };
    if (orgErr) return { ok: false, error: orgErr.message };
    for (const row of followRows ?? []) {
      const organizerId = (row as { organizer_id: string }).organizer_id;
      followerCountByOrganizer.set(organizerId, (followerCountByOrganizer.get(organizerId) ?? 0) + 1);
    }
    for (const row of orgRows ?? []) {
      const r = row as { id: string; verified?: boolean | null };
      if (r.verified) verifiedOrganizer.add(r.id);
    }
  }

  const followsByUser = new Map<string, Set<string>>();
  for (const row of follows ?? []) {
    const r = row as { user_id: string; city_slug: string };
    if (!followsByUser.has(r.user_id)) followsByUser.set(r.user_id, new Set());
    followsByUser.get(r.user_id)?.add(r.city_slug);
  }

  const rows: InsertJob[] = [];
  const scheduledFor = new Date().toISOString();
  const nowMs = now.getTime();
  for (const row of settingsRows ?? []) {
    const settings = row as { user_id: string; push_enabled: boolean; notify_trending_alerts: boolean };
    if (!settings.push_enabled || !settings.notify_trending_alerts) continue;
    const followedCities = followsByUser.get(settings.user_id) ?? new Set<string>();

    let winner: FestivalRow | null = null;
    let winnerScore = -1;
    for (const festival of festivals as FestivalRow[]) {
      const festivalWithSignals = {
        ...festival,
        saves_count: savesByFestival.get(festival.id) ?? 0,
      };
      const citySlug = festival.city_id != null ? citySlugById.get(festival.city_id) ?? null : null;
      const proximityBoost = citySlug && followedCities.has(citySlug) ? 15 : 0;
      const organizerId = (festival as FestivalRow & { organizer_id?: string | null }).organizer_id ?? null;
      const velocityScore = Math.min(24, (saveVelocityByFestival.get(festival.id) ?? 0) * 2);
      const followerScore = organizerId ? Math.min(12, Math.floor((followerCountByOrganizer.get(organizerId) ?? 0) / 3)) : 0;
      const verifiedBoost = organizerId && verifiedOrganizer.has(organizerId) ? 8 : 0;
      const score =
        trendingScore(festivalWithSignals, nowMs, proximityBoost) + velocityScore + followerScore + verifiedBoost;
      if (score > winnerScore) {
        winner = festivalWithSignals;
        winnerScore = score;
      }
    }
    if (!winner) continue;
    const winnerCitySlug = winner.city_id != null ? citySlugById.get(winner.city_id) ?? null : null;
    const cityLabel = normalizeCityLabelFromSlug(winnerCitySlug);
    rows.push({
      user_id: settings.user_id,
      festival_id: winner.id,
      job_type: "trending",
      scheduled_for: scheduledFor,
      dedupe_key: makeDedupeKey([settings.user_id, "trending", formatSofiaDate(now)]),
      payload_json: buildTrendingPayload({
        slug: winner.slug,
        festivalId: winner.id,
        cityLabel,
        teaser: winner.title?.trim() || "Открий нещо интересно тази седмица",
      }),
    });
  }

  const { inserted, error } = await insertNotificationJobs(supabase, rows);
  if (error) return { ok: false, error };
  return { ok: true, inserted };
}
