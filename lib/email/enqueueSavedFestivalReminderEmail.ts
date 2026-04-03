import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationJobRow } from "@/lib/notifications/types";
import { TZ } from "@/lib/notifications/time";
import { getBaseUrl } from "@/lib/seo";
import { formatSettlementDisplayName, festivalCityLabel } from "@/lib/settlements/formatDisplayName";

import {
  dedupeKeyReminderOneDayBefore,
  dedupeKeyReminderSameDay,
} from "./emailDedupeKeys";
import {
  EMAIL_JOB_TYPE_REMINDER_1_DAY_BEFORE,
  EMAIL_JOB_TYPE_REMINDER_SAME_DAY,
  type EmailJobType,
} from "./emailJobTypes";
import { enqueueEmailJobSafe } from "./enqueueSafe";
import { resolveAuthUserEmail } from "./resolveAuthUserEmail";

const FESTIVAL_REMINDER_SELECT =
  "id,title,slug,city,city_id,start_date,start_time,location_name,address,cities:cities!left(name_bg,slug,is_village)";

export type FestivalRowForReminderEmail = {
  id: string;
  title: string | null;
  slug: string | null;
  city: string | null;
  city_id: number | null;
  start_date: string | null;
  start_time: string | null;
  location_name: string | null;
  address: string | null;
  cities?: { name_bg: string; slug: string; is_village: boolean } | { name_bg: string; slug: string; is_village: boolean }[] | null;
};

function normalizeCityJoin(
  raw: FestivalRowForReminderEmail["cities"],
): { name_bg: string; slug: string; is_village: boolean } | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object" ? first : null;
  }
  return raw;
}

function formatBgLongDate(isoDate: string | null | undefined): string | null {
  if (!isoDate?.trim()) return null;
  const d = isoDate.includes("T")
    ? new Date(isoDate)
    : new Date(`${isoDate.trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("bg-BG", {
      timeZone: TZ,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return null;
  }
}

/** Postgres `time` as HH:MM:SS → short BG label */
function formatStartTimeDisplay(dbTime: string | null | undefined): string | null {
  if (!dbTime?.trim()) return null;
  const m = String(dbTime).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = m[2];
  if (Number.isNaN(hh)) return null;
  return `${hh}:${mm} ч.`;
}

function locationSummaryFromFestival(row: FestivalRowForReminderEmail): string | null {
  const loc = row.location_name?.trim() || row.address?.trim() || "";
  if (!loc) return null;
  return loc.length > 280 ? `${loc.slice(0, 277)}…` : loc;
}

function cityDisplayFromFestival(row: FestivalRowForReminderEmail): string | null {
  const c = normalizeCityJoin(row.cities);
  if (c?.name_bg) {
    return formatSettlementDisplayName(c.name_bg, c.is_village);
  }
  const fallback = festivalCityLabel({ city: row.city ?? "", city_name_display: null }, "").trim();
  return fallback || null;
}

function reminderSubkindToEmailType(subkind: unknown): EmailJobType | null {
  if (subkind === "24h") return EMAIL_JOB_TYPE_REMINDER_1_DAY_BEFORE;
  if (subkind === "2h") return EMAIL_JOB_TYPE_REMINDER_SAME_DAY;
  return null;
}

function reminderKindFromSubkind(subkind: "24h" | "2h"): "1_day_before" | "two_hours_before" {
  return subkind === "24h" ? "1_day_before" : "two_hours_before";
}

export async function loadFestivalsForReminderEmails(
  supabase: SupabaseClient,
  festivalIds: string[],
): Promise<Map<string, FestivalRowForReminderEmail>> {
  const map = new Map<string, FestivalRowForReminderEmail>();
  const unique = [...new Set(festivalIds.filter(Boolean))];
  if (!unique.length) return map;

  const { data, error } = await supabase.from("festivals").select(FESTIVAL_REMINDER_SELECT).in("id", unique);

  if (error) {
    console.error("[reminder_email] festival batch load failed", { message: error.message });
    return map;
  }

  for (const row of (data ?? []) as FestivalRowForReminderEmail[]) {
    if (row?.id) {
      map.set(row.id, row);
    }
  }
  return map;
}

/**
 * Enqueue backup reminder email for the same due `notification_jobs` reminder row.
 * Call only after the job has passed the same gates as push in `processDueNotificationJobs`
 * (`push_enabled`, quiet hours for reminders, valid FCM payload) and **before** loading device tokens,
 * so email is not blocked by missing `device_tokens`.
 * Fail-soft: logs and returns on missing data, email, or enqueue errors.
 */
export async function enqueueSavedFestivalReminderEmailFromJob(
  supabase: SupabaseClient,
  job: NotificationJobRow,
  festivalById: Map<string, FestivalRowForReminderEmail>,
): Promise<void> {
  if (job.job_type !== "reminder") {
    return;
  }

  const rawSubkind = (job.payload_json as Record<string, unknown>).reminder_subkind;
  if (rawSubkind !== "24h" && rawSubkind !== "2h") {
    console.warn("[reminder_email] skip: invalid reminder_subkind", { job_id: job.id, rawSubkind });
    return;
  }

  const emailType = reminderSubkindToEmailType(rawSubkind);
  if (!emailType) {
    return;
  }

  const payload = job.payload_json;
  const festivalId = payload.festival_id ?? job.festival_id;
  if (!festivalId) {
    console.warn("[reminder_email] skip: missing festival_id", { job_id: job.id });
    return;
  }

  const fest = festivalById.get(festivalId);
  if (!fest) {
    console.warn("[reminder_email] skip: festival not loaded", { job_id: job.id, festival_id: festivalId });
    return;
  }

  const slug = fest.slug?.trim();
  if (!slug) {
    console.warn("[reminder_email] skip: missing festival slug", { job_id: job.id, festival_id: festivalId });
    return;
  }

  const title = fest.title?.trim() || payload.title?.trim() || "Фестивал";
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const festivalUrl = `${baseUrl}/festivals/${encodeURIComponent(slug)}`;

  const recipient = await resolveAuthUserEmail(supabase, job.user_id);
  if (!recipient) {
    console.info("[reminder_email] skip: no recipient email", { user_id: job.user_id, job_id: job.id });
    return;
  }

  const dedupeKey =
    rawSubkind === "24h"
      ? dedupeKeyReminderOneDayBefore(job.user_id, festivalId)
      : dedupeKeyReminderSameDay(job.user_id, festivalId);

  const emailPayload = {
    userId: job.user_id,
    festivalId,
    festivalTitle: title,
    festivalSlug: slug,
    festivalUrl,
    cityDisplay: cityDisplayFromFestival(fest),
    locationSummary: locationSummaryFromFestival(fest),
    startDateDisplay: formatBgLongDate(fest.start_date),
    startTimeDisplay: formatStartTimeDisplay(fest.start_time),
    reminderKind: reminderKindFromSubkind(rawSubkind),
  };

  await enqueueEmailJobSafe(
    supabase,
    {
      type: emailType,
      recipientEmail: recipient,
      recipientUserId: job.user_id,
      payload: emailPayload,
      dedupeKey,
    },
    `saved_festival_reminder:${job.id}`,
  );
}
