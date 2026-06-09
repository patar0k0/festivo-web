import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Operational health snapshot for the admin dashboard.
 *
 * Reads service-role-only pipeline tables (`cron_locks`, `email_jobs`,
 * `notification_jobs`, `ingest_jobs`, `push_delivery_audit`) and reduces them to
 * a small set of presentation-ready metrics with a traffic-light level. The goal
 * is to surface a *silent* pipeline failure (cron stopped, jobs piling up) without
 * leaving the dashboard.
 *
 * Fail-safe by design: a null client or any query error degrades that metric to
 * `unknown` (grey) instead of throwing — the dashboard must never break because a
 * health probe failed.
 */

export type HealthLevel = "ok" | "warn" | "alert" | "unknown";

export type DashboardHealthMetric = {
  key: string;
  /** Bulgarian short label, e.g. "Cron пулс". */
  label: string;
  /** Primary value rendered big, e.g. "преди 4 мин" or "3". */
  display: string;
  /** Secondary context line, e.g. "провалени (24ч)". */
  detail: string;
  level: HealthLevel;
  href?: string;
};

export type DashboardHealth = {
  /** False when the service-role client is unavailable (no env key). */
  available: boolean;
  metrics: DashboardHealthMetric[];
};

/**
 * Marker row written by the cron worker after each (hourly) cleanup tick.
 * Must match `CLEANUP_MARKER` in `app/api/cron/worker/route.ts`.
 */
const CRON_CLEANUP_MARKER = "cron_worker_cleanup_marker";

/** ingest_jobs older than this in pending/processing are considered stuck. */
const INGEST_STUCK_MINUTES = 30;

function levelForCount(n: number | null, warnAt: number, alertAt: number): HealthLevel {
  if (n == null) return "unknown";
  if (n >= alertAt) return "alert";
  if (n >= warnAt) return "warn";
  return "ok";
}

function formatAge(minutes: number): string {
  if (minutes < 1) return "току-що";
  if (minutes < 60) return `преди ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `преди ${hours} ч`;
  const days = Math.floor(hours / 24);
  return `преди ${days} д`;
}

async function safeCount(
  builder: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  context: string,
): Promise<number | null> {
  try {
    const { count, error } = await builder;
    if (error) {
      console.error(`[dashboardHealth] ${context}:`, error.message);
      return null;
    }
    return count ?? 0;
  } catch (e) {
    console.error(`[dashboardHealth] ${context} threw:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function fetchDashboardHealth(admin: SupabaseClient | null): Promise<DashboardHealth> {
  if (!admin) {
    return { available: false, metrics: [] };
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const ingestStuckBefore = new Date(now - INGEST_STUCK_MINUTES * 60 * 1000).toISOString();

  const cronPromise = (async (): Promise<{ ageMinutes: number | null } | null> => {
    try {
      const { data, error } = await admin
        .from("cron_locks")
        .select("locked_at")
        .eq("name", CRON_CLEANUP_MARKER)
        .maybeSingle();
      if (error) {
        console.error("[dashboardHealth] cron marker:", error.message);
        return null;
      }
      if (!data?.locked_at) return { ageMinutes: null };
      const ageMs = now - new Date(data.locked_at).getTime();
      return { ageMinutes: Math.max(0, Math.round(ageMs / 60000)) };
    } catch (e) {
      console.error("[dashboardHealth] cron marker threw:", e instanceof Error ? e.message : e);
      return null;
    }
  })();

  const [cron, emailFailed, emailBounced, notifFailed, ingestStuck, ingestFailed, pushFailed] = await Promise.all([
    cronPromise,
    safeCount(
      admin.from("email_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h),
      "email failed",
    ),
    safeCount(
      admin
        .from("email_jobs")
        .select("id", { count: "exact", head: true })
        .eq("delivery_status", "bounced")
        .gte("created_at", since24h),
      "email bounced",
    ),
    safeCount(
      admin
        .from("notification_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("updated_at", since24h),
      "notification failed",
    ),
    safeCount(
      admin
        .from("ingest_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"])
        .lt("created_at", ingestStuckBefore),
      "ingest stuck",
    ),
    safeCount(
      admin.from("ingest_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h),
      "ingest failed",
    ),
    safeCount(
      admin
        .from("push_delivery_audit")
        .select("id", { count: "exact", head: true })
        .eq("send_status", "failed")
        .gte("created_at", since24h),
      "push failed",
    ),
  ]);

  // Cron pulse: cleanup marker refreshes at most hourly, so a healthy worker keeps
  // it under ~60 min. 90 min = suspicious, 4h = almost certainly down.
  let cronLevel: HealthLevel;
  let cronDisplay: string;
  if (!cron) {
    cronLevel = "unknown";
    cronDisplay = "няма данни";
  } else if (cron.ageMinutes == null) {
    cronLevel = "unknown";
    cronDisplay = "—";
  } else if (cron.ageMinutes > 240) {
    cronLevel = "alert";
    cronDisplay = formatAge(cron.ageMinutes);
  } else if (cron.ageMinutes > 90) {
    cronLevel = "warn";
    cronDisplay = formatAge(cron.ageMinutes);
  } else {
    cronLevel = "ok";
    cronDisplay = formatAge(cron.ageMinutes);
  }

  const metrics: DashboardHealthMetric[] = [
    {
      key: "cron",
      label: "Cron пулс",
      display: cronDisplay,
      detail: "последен tick (на ~5 мин)",
      level: cronLevel,
      href: "/admin/observability",
    },
    {
      key: "email",
      label: "Имейли",
      display: emailFailed == null ? "—" : String(emailFailed),
      detail: emailBounced && emailBounced > 0 ? `провал · ${emailBounced} отскока (24ч)` : "провал (24ч)",
      level: levelForCount(emailFailed, 1, 10),
      href: "/admin/email-jobs?status=failed",
    },
    {
      key: "notifications",
      label: "Известия",
      display: notifFailed == null ? "—" : String(notifFailed),
      detail: "провал (24ч)",
      level: levelForCount(notifFailed, 1, 10),
      href: "/admin/notifications?status=failed",
    },
    {
      key: "ingest",
      label: "Ingest опашка",
      display: ingestStuck == null ? "—" : String(ingestStuck),
      detail:
        ingestFailed && ingestFailed > 0
          ? `заседнали >30м · ${ingestFailed} провал (24ч)`
          : "заседнали >30 мин",
      level:
        levelForCount(ingestStuck, 1, 5) === "ok" && (ingestFailed ?? 0) > 0
          ? "warn"
          : levelForCount(ingestStuck, 1, 5),
      href: "/admin/ingest",
    },
    {
      key: "push",
      label: "Push",
      display: pushFailed == null ? "—" : String(pushFailed),
      detail: "провал (24ч)",
      level: levelForCount(pushFailed, 1, 20),
      href: "/admin/notifications?status=failed",
    },
  ];

  return { available: true, metrics };
}
