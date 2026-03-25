import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationJobType } from "./types";

/** Minutes; null = no time-window dedupe (reminder). */
export function dedupeWindowMinutes(jobType: NotificationJobType): number | null {
  switch (jobType) {
    case "update":
      return 60;
    case "weekend":
      return 6 * 60;
    case "new_city":
      return 24 * 60;
    case "reminder":
      return null;
    default:
      return null;
  }
}

/** True if a pending/sent job exists in the window (same user, type, festival when set). */
export async function hasRecentWindowDuplicate(
  supabase: SupabaseClient,
  args: {
    user_id: string;
    festival_id: string | null;
    job_type: NotificationJobType;
  },
): Promise<boolean> {
  const windowMin = dedupeWindowMinutes(args.job_type);
  if (windowMin == null) {
    return false;
  }

  const since = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
  let q = supabase
    .from("notification_jobs")
    .select("id")
    .eq("user_id", args.user_id)
    .eq("job_type", args.job_type)
    .gte("created_at", since)
    .in("status", ["pending", "sent"])
    .limit(1);

  if (args.festival_id) {
    q = q.eq("festival_id", args.festival_id);
  } else {
    q = q.is("festival_id", null);
  }

  const { data, error } = await q;
  if (error) {
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}
