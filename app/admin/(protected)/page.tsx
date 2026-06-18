import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchDashboardHealth, type HealthLevel } from "@/lib/admin/dashboardHealth";
import { fetchUserGrowthStats } from "@/lib/admin/dashboardUserStats";
import { fetchSocialRepostStatus } from "@/lib/admin/dashboardSocialRepost";
import { formatDateValueAsDdMmYyyy } from "@/lib/dates/euDateFormat";

type FestivalStatus = "draft" | "verified" | "rejected" | "archived";

type SupabaseAdmin = NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"];

async function getStatusCount(supabase: SupabaseAdmin | null, status: FestivalStatus) {
  if (!supabase) return 0;
  const { count } = await supabase.from("festivals").select("id", { count: "exact", head: true }).eq("status", status);
  return count ?? 0;
}

async function getPendingCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const { count } = await supabase.from("pending_festivals").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}

const STALE_QUEUE_DAYS = 7;

function staleCutoffIso() {
  return new Date(Date.now() - STALE_QUEUE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Pending festivals waiting longer than STALE_QUEUE_DAYS — a backlog signal. */
async function getStalePendingCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("pending_festivals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", staleCutoffIso());
  return count ?? 0;
}

/** Pending organizer claims waiting longer than STALE_QUEUE_DAYS. */
async function getStalePendingOrgClaimsCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("organizer_members")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", staleCutoffIso());
  return count ?? 0;
}

async function getDiscoveryRecentCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { count } = await supabase
    .from("discovered_links")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
  return count ?? 0;
}

/** Discovered links in the 7d *before* the last 7d — for a trend delta. Null on error. */
async function getDiscoveryPreviousCount(supabase: SupabaseAdmin | null): Promise<number | null> {
  if (!supabase) return null;
  const now = Date.now();
  const from = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("discovered_links")
    .select("id", { count: "exact", head: true })
    .gte("created_at", from)
    .lt("created_at", to);
  if (error) {
    console.error("admin dashboard discovery previous count:", error.message);
    return null;
  }
  return count ?? 0;
}

async function getActiveOrganizersCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const { count } = await supabase.from("organizers").select("id", { count: "exact", head: true }).eq("is_active", true);
  return count ?? 0;
}

async function getVerifiedOrganizersCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("organizers")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("verified", true);
  return count ?? 0;
}

async function getUnverifiedOrganizersCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("organizers")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("verified", false);
  return count ?? 0;
}

async function getPendingOrganizerClaimsCount(supabase: SupabaseAdmin | null) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("organizer_members")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

type PendingQueueDbRow = {
  id: string | number;
  title: string | null;
  city_guess: string | null;
  start_date: string | null;
  end_date: string | null;
  date_guess: string | null;
  source_url: string | null;
  submission_source: string | null;
  created_at: string;
  city: { name_bg: string | null } | { name_bg: string | null }[] | null;
};

type OrganizerClaimQueueRow = {
  id: string;
  created_at: string;
  role: string;
  user_id: string;
  organizer: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null;
};

function normalizeCityName(city: PendingQueueDbRow["city"]): string | null {
  if (!city) return null;
  const row = Array.isArray(city) ? city[0] : city;
  return row?.name_bg?.trim() || null;
}

function normalizeOrganizerName(org: OrganizerClaimQueueRow["organizer"]): { name: string | null; slug: string | null } {
  if (!org) return { name: null, slug: null };
  const row = Array.isArray(org) ? org[0] : org;
  if (!row) return { name: null, slug: null };
  return {
    name: row.name?.trim() ?? null,
    slug: row.slug?.trim() ?? null,
  };
}

function formatSourceLabel(submissionSource: string | null, sourceUrl: string | null) {
  const sub = submissionSource?.trim();
  if (sub) return sub;
  const url = sourceUrl?.trim();
  if (!url) return "—";
  try {
    return new URL(url).hostname;
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}…` : url;
  }
}

function formatQueueDate(row: Pick<PendingQueueDbRow, "start_date" | "end_date" | "date_guess" | "created_at">) {
  const iso = row.start_date ?? row.end_date;
  if (iso) {
    const line = formatDateValueAsDdMmYyyy(iso);
    if (line) return line;
  }
  const guess = row.date_guess?.trim();
  if (guess) return guess.length > 32 ? `${guess.slice(0, 29)}…` : guess;
  const created = row.created_at;
  if (created) {
    const d = parseISO(created);
    if (isValid(d)) return format(d, "dd/MM/yyyy");
  }
  return "—";
}

function shortUserId(id: string) {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

/**
 * Period-over-period delta line for a flow metric. Returns null when either
 * value is missing (so the caller can fall back to its default hint).
 * Up = green (growth), down = amber, flat = muted.
 */
function trendDelta(current: number | null | undefined, previous: number | null | undefined, label: string) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  const color = delta > 0 ? "text-emerald-700" : delta < 0 ? "text-[#9a6b16]" : "text-black/40";
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const sign = delta > 0 ? `+${delta}` : String(delta);
  return (
    <p className={`mt-0.5 text-[11px] font-medium ${color}`}>
      {arrow} {sign} {label}
    </p>
  );
}

async function loadPendingQueue(supabase: SupabaseAdmin | null): Promise<PendingQueueDbRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("pending_festivals")
    .select(
      "id,title,city_guess,start_date,end_date,date_guess,source_url,submission_source,created_at,city:cities(name_bg)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("admin dashboard pending queue:", error.message);
    return [];
  }
  return (data ?? []) as PendingQueueDbRow[];
}

async function loadPendingOrganizerClaimsQueue(supabase: SupabaseAdmin | null): Promise<OrganizerClaimQueueRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("organizer_members")
    .select("id,created_at,role,user_id,organizer:organizers(name,slug)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("admin dashboard organizer claims queue:", error.message);
    return [];
  }
  return (data ?? []) as OrganizerClaimQueueRow[];
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await getAdminContext();
  const supabase = admin?.supabase ?? null;

  // Pipeline health and user growth read service-role-only sources, so they use a
  // service-role client (the admin-context `supabase` is user-authenticated /
  // RLS-bound). Created once and shared across both probes.
  const serviceClient = supabaseAdmin();
  const [
    pending,
    draft,
    verified,
    rejected,
    archived,
    discoveryRecent,
    discoveryPrevious,
    queueRows,
    orgQueueRows,
    organizersTotal,
    organizersVerified,
    organizersUnverified,
    pendingOrgClaims,
    stalePending,
    stalePendingOrgClaims,
    health,
    userGrowth,
    socialRepost,
  ] = await Promise.all([
    getPendingCount(supabase),
    getStatusCount(supabase, "draft"),
    getStatusCount(supabase, "verified"),
    getStatusCount(supabase, "rejected"),
    getStatusCount(supabase, "archived"),
    getDiscoveryRecentCount(supabase),
    getDiscoveryPreviousCount(supabase),
    loadPendingQueue(supabase),
    loadPendingOrganizerClaimsQueue(supabase),
    getActiveOrganizersCount(supabase),
    getVerifiedOrganizersCount(supabase),
    getUnverifiedOrganizersCount(supabase),
    getPendingOrganizerClaimsCount(supabase),
    getStalePendingCount(supabase),
    getStalePendingOrgClaimsCount(supabase),
    fetchDashboardHealth(serviceClient),
    fetchUserGrowthStats(serviceClient),
    fetchSocialRepostStatus(serviceClient),
  ]);

  const festivalStats = [
    { label: "Чернова", value: draft, href: "/admin/festivals?status=draft", hint: "фестивали" },
    { label: "Потвърдени", value: verified, href: "/admin/festivals?status=verified", hint: "фестивали" },
    { label: "Отхвърлени", value: rejected, href: "/admin/festivals?status=rejected", hint: "фестивали" },
    { label: "Архивирани", value: archived, href: "/admin/festivals?status=archived", hint: "фестивали" },
  ] as const;

  const kpiCardClass =
    "flex flex-col rounded-xl border border-black/[0.08] bg-white/80 p-3 transition-colors hover:border-black/[0.14] hover:bg-white";

  const priorityHighlight = (active: boolean) => (active ? "border-[#d4a017]/30 bg-[#fffbeb]/70" : "");

  const staleBadgeClass =
    "mt-1 inline-flex w-fit items-center rounded-md border border-[#d4a017]/30 bg-[#fffbeb] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a6b16]";

  const linkClass =
    "rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition hover:bg-black/[0.04]";

  const domainCardClass = "rounded-xl border border-black/[0.08] bg-white/80 p-4";

  const healthStyles: Record<HealthLevel, { card: string; dot: string; value: string; tag: string }> = {
    ok: { card: "border-emerald-600/20 bg-emerald-50/40", dot: "bg-emerald-500", value: "text-emerald-800", tag: "OK" },
    warn: { card: "border-[#d4a017]/30 bg-[#fffbeb]/70", dot: "bg-[#d4a017]", value: "text-[#9a6b16]", tag: "Внимание" },
    alert: { card: "border-[#b13a1a]/30 bg-[#fdf2ee]/70", dot: "bg-[#b13a1a]", value: "text-[#b13a1a]", tag: "Проблем" },
    unknown: { card: "border-black/[0.08] bg-white/80", dot: "bg-black/25", value: "text-black/55", tag: "Няма данни" },
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Админ</p>
        <h1 className="mt-1 text-xl font-bold text-[#0c0e14] md:text-2xl">Табло</h1>
        <p className="mt-1 max-w-2xl text-sm text-black/55">
          Приоритети за модерация, опашки и бърз достъп до фестивали, организатори и открития.
        </p>
      </div>

      {/* Priority strip */}
      <section aria-label="Приоритети">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Приоритети</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/pending-festivals"
            className={`${kpiCardClass} ${priorityHighlight(pending > 0)}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Чакащи фестивали</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{pending}</p>
            {stalePending > 0 ? (
              <span className={staleBadgeClass}>{stalePending} чакат &gt;{STALE_QUEUE_DAYS} дни</span>
            ) : (
              <p className="mt-0.5 text-[11px] text-black/45">Към опашката →</p>
            )}
          </Link>

          <Link
            href="/admin/organizer-claims"
            className={`${kpiCardClass} ${priorityHighlight(pendingOrgClaims > 0)}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Заявки организатори</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{pendingOrgClaims}</p>
            {stalePendingOrgClaims > 0 ? (
              <span className={staleBadgeClass}>{stalePendingOrgClaims} чакат &gt;{STALE_QUEUE_DAYS} дни</span>
            ) : (
              <p className="mt-0.5 text-[11px] text-black/45">Чакащи заявки / claims →</p>
            )}
          </Link>

          <Link href="/admin/discovery" className={kpiCardClass}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Нови открития (7 дни)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{discoveryRecent}</p>
            {trendDelta(discoveryRecent, discoveryPrevious, "спрямо мин. седмица") ?? (
              <p className="mt-0.5 text-[11px] text-black/45">Открития →</p>
            )}
          </Link>

          <Link href="/admin/festivals?status=draft" className={`${kpiCardClass} ${priorityHighlight(draft > 0)}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Чернови в каталога</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{draft}</p>
            <p className="mt-0.5 text-[11px] text-black/45">Фестивали (чернова) →</p>
          </Link>
        </div>
      </section>

      {/* System health */}
      {health.available ? (
        <section aria-label="Здраве на системата">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Здраве на системата</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {health.metrics.map((m) => {
              const s = healthStyles[m.level];
              const inner = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">{m.label}</p>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
                  </div>
                  <p className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${s.value}`}>{m.display}</p>
                  <p className="mt-0.5 text-[11px] text-black/45">{m.detail}</p>
                  <p className="sr-only">Състояние: {s.tag}</p>
                </>
              );
              const cardClass = `flex flex-col rounded-xl border p-3 transition-colors ${s.card}`;
              return m.href ? (
                <Link key={m.key} href={m.href} className={`${cardClass} hover:brightness-[0.98]`}>
                  {inner}
                </Link>
              ) : (
                <div key={m.key} className={cardClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Main queues */}
      <section aria-label="Опашки" className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Фестивали</p>
              <h2 className="text-sm font-semibold text-[#0c0e14]">Последни чакащи фестивали</h2>
            </div>
            <Link
              href="/admin/pending-festivals"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45 hover:text-[#0c0e14]"
            >
              Пълен списък →
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white/80">
            <table className="min-w-full divide-y divide-black/[0.06] text-sm">
              <thead className="bg-black/[0.02] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">
                <tr>
                  <th className="px-3 py-2">Заглавие</th>
                  <th className="px-3 py-2">Град</th>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Източник</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {queueRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-black/50">
                      Няма чакащи записи.
                    </td>
                  </tr>
                ) : (
                  queueRows.map((row) => {
                    const id = String(row.id);
                    const title = row.title?.trim() || "(без заглавие)";
                    const city = normalizeCityName(row.city) ?? row.city_guess?.trim() ?? "—";
                    const dateLabel = formatQueueDate(row);
                    const sourceLabel = formatSourceLabel(row.submission_source, row.source_url);
                    const detailBase = `/admin/pending-festivals/${id}`;
                    return (
                      <tr key={id} className="text-[#0c0e14]">
                        <td className="max-w-[min(20rem,35vw)] px-3 py-2">
                          <Link href={detailBase} className="font-medium text-[#0c0e14] hover:underline" title={title}>
                            {title.length > 64 ? `${title.slice(0, 61)}…` : title}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-black/75">{city}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black/75">{dateLabel}</td>
                        <td className="max-w-[10rem] px-3 py-2 text-xs text-black/65 hidden sm:table-cell" title={sourceLabel}>
                          <span className="line-clamp-2">{sourceLabel}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Link href={`${detailBase}?intent=approve`} className={`${linkClass} text-emerald-800/90`}>
                              Одобри
                            </Link>
                            <Link href={`${detailBase}?intent=edit`} className={`${linkClass} text-[#0c0e14]`}>
                              Редактирай
                            </Link>
                            <Link href={`${detailBase}?intent=reject`} className={`${linkClass} text-[#b13a1a]`}>
                              Отхвърли
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Организатори</p>
              <h2 className="text-sm font-semibold text-[#0c0e14]">Последни заявки за профил</h2>
            </div>
            <Link
              href="/admin/organizer-claims"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45 hover:text-[#0c0e14]"
            >
              Пълен списък →
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white/80">
            <table className="min-w-full divide-y divide-black/[0.06] text-sm">
              <thead className="bg-black/[0.02] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">
                <tr>
                  <th className="px-3 py-2">Организатор</th>
                  <th className="px-3 py-2">Роля</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Потребител</th>
                  <th className="px-3 py-2">Подадена</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {orgQueueRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-black/50">
                      Няма чакащи заявки.
                    </td>
                  </tr>
                ) : (
                  orgQueueRows.map((row) => {
                    const { name: orgName, slug: orgSlug } = normalizeOrganizerName(row.organizer);
                    const displayName = orgName?.trim() || "(без име)";
                    const createdAt = row.created_at ? parseISO(row.created_at) : null;
                    const created =
                      createdAt && isValid(createdAt) ? format(createdAt, "dd/MM/yyyy HH:mm") : "—";
                    const claimHref = `/admin/organizer-claims/${row.id}`;
                    return (
                      <tr key={row.id} className="text-[#0c0e14]">
                        <td className="max-w-[min(18rem,40vw)] px-3 py-2">
                          <span className="font-medium">{displayName}</span>
                          {orgSlug ? (
                            <p className="text-[11px] text-black/45">
                              <Link href={`/organizers/${orgSlug}`} className="underline hover:text-[#0c0e14]">
                                /{orgSlug}
                              </Link>
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-black/75">{row.role}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-black/60 hidden sm:table-cell" title={row.user_id}>
                          {shortUserId(row.user_id)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-xs text-black/75">{created}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <Link
                            href={claimHref}
                            className={`${linkClass} inline-flex text-[#0c0e14]`}
                          >
                            Преглед
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Domains: festivals / organizers / discovery */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className={domainCardClass} aria-label="Фестивали — обобщение">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Фестивали</p>
          <h3 className="mt-1 text-sm font-semibold text-[#0c0e14]">Каталог и статуси</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {festivalStats.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-2.5 py-2 transition hover:border-black/[0.12] hover:bg-black/[0.04]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">{item.label}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{item.value}</p>
                <p className="text-[10px] text-black/40">{item.hint}</p>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/festivals"
              className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.03]"
            >
              Всички фестивали
            </Link>
            <Link
              href="/admin/pending-festivals"
              className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.03]"
            >
              Чакащи за модерация
            </Link>
          </div>
        </section>

        <section className={domainCardClass} aria-label="Организатори — обобщение">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Организатори</p>
          <h3 className="mt-1 text-sm font-semibold text-[#0c0e14]">Профили и заявки</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-2 border-b border-black/[0.06] pb-2">
              <dt className="text-black/55">Активни профили</dt>
              <dd>
                <Link href="/admin/organizers" className="font-semibold tabular-nums text-[#0c0e14] underline-offset-2 hover:underline">
                  {organizersTotal}
                </Link>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-b border-black/[0.06] pb-2">
              <dt className="text-black/55">Потвърдени</dt>
              <dd>
                <Link href="/admin/organizers" className="font-semibold tabular-nums text-[#0c0e14] underline-offset-2 hover:underline">
                  {organizersVerified}
                </Link>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-b border-black/[0.06] pb-2">
              <dt className="text-black/55">Чакащи заявки</dt>
              <dd>
                <Link href="/admin/organizer-claims" className="font-semibold tabular-nums text-[#0c0e14] underline-offset-2 hover:underline">
                  {pendingOrgClaims}
                </Link>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-black/55">Непотвърдени профили</dt>
              <dd>
                <Link href="/admin/organizers" className="font-semibold tabular-nums text-[#0c0e14] underline-offset-2 hover:underline">
                  {organizersUnverified}
                </Link>
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/organizers"
              className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.03]"
            >
              Списък организатори
            </Link>
            <Link
              href="/admin/organizers/duplicates"
              className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.03]"
            >
              Дубликати
            </Link>
          </div>
        </section>

        <section className={domainCardClass} aria-label="Откритие и внасяне">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Откритие / внасяне</p>
          <h3 className="mt-1 text-sm font-semibold text-[#0c0e14]">Инжест и проучване</h3>
          <p className="mt-2 text-sm text-black/60">
            <span className="font-semibold tabular-nums text-[#0c0e14]">{discoveryRecent}</span> нови връзки за последните 7 дни.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/admin/discovery" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
                Открития — преглед и триаж
              </Link>
            </li>
            <li>
              <Link href="/admin/ingest" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
                Внасяне на данни
              </Link>
            </li>
            <li>
              <Link href="/admin/research" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
                Проучване на фестивал (Perplexity / Gemini)
              </Link>
            </li>
            <li>
              <Link href="/admin/organizers/research" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
                Нов организатор (Perplexity)
              </Link>
            </li>
          </ul>
        </section>
      </div>

      {/* User growth */}
      {userGrowth.available ? (
        <section aria-label="Потребители — растеж">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Потребители</p>
            <Link
              href="/admin/users"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45 hover:text-[#0c0e14]"
            >
              Списък потребители →
            </Link>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              {
                key: "d1",
                label: "Нови (24ч)",
                value: userGrowth.new24h,
                delta: trendDelta(userGrowth.new24h, userGrowth.prev24h, "спрямо вчера"),
              },
              {
                key: "d7",
                label: "Нови (7 дни)",
                value: userGrowth.new7d,
                delta: trendDelta(userGrowth.new7d, userGrowth.prev7d, "спрямо мин. седмица"),
              },
              {
                key: "total",
                label: userGrowth.capped ? "Общо регистрирани (≥)" : "Общо регистрирани",
                value: userGrowth.total,
                delta: null,
              },
            ].map((item) => (
              <Link key={item.key} href="/admin/users" className={kpiCardClass}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                  {item.value == null ? "—" : item.value}
                </p>
                {item.delta ?? <p className="mt-0.5 text-[11px] text-black/45">Потребители →</p>}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Social repost pipeline */}
      {socialRepost.available ? (
        <section aria-label="Соц. repost">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
            Соц. repost (Telegram → TikTok / IG)
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className={kpiCardClass}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">В процес</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                {socialRepost.active == null ? "—" : socialRepost.active}
              </p>
              <p className="mt-0.5 text-[11px] text-black/45">опашка / преглед / насрочени</p>
            </div>
            <div className={kpiCardClass}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Публикувани (24ч)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-emerald-800">
                {socialRepost.published24h == null ? "—" : socialRepost.published24h}
              </p>
              <p className="mt-0.5 text-[11px] text-black/45">успешни постове</p>
            </div>
            <div className={`${kpiCardClass} ${socialRepost.failed24h && socialRepost.failed24h > 0 ? "border-[#b13a1a]/30 bg-[#fdf2ee]/70" : ""}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Провалени (24ч)</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${
                  socialRepost.failed24h && socialRepost.failed24h > 0 ? "text-[#b13a1a]" : ""
                }`}
              >
                {socialRepost.failed24h == null ? "—" : socialRepost.failed24h}
              </p>
              <p className="mt-0.5 text-[11px] text-black/45">по всички мрежи</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* External analytics & tools */}
      <section className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5" aria-label="Статистика и инструменти">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Външни платформи</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            {
              label: "Vercel Analytics",
              hint: "Трафик, Web Vitals",
              href: "https://vercel.com/patar0k0s-projects/festivo-web/analytics",
              icon: "▲",
            },
            {
              label: "Umami",
              hint: "Посещения, страници",
              href: "https://cloud.umami.is",
              icon: "📊",
            },
            {
              label: "Google Search Console",
              hint: "SEO, импресии, кликове",
              href: "https://search.google.com/search-console?resource_id=https://festivo.bg",
              icon: "🔍",
            },
            {
              label: "Facebook Insights",
              hint: "Страница и реклами",
              href: "https://www.facebook.com/festivo.bg/insights",
              icon: "📘",
            },
            {
              label: "Google Analytics",
              hint: "Аудитория, поведение",
              href: "https://analytics.google.com",
              icon: "📈",
            },
            {
              label: "Sentry",
              hint: "Грешки и производителност",
              href: "https://sentry.io/organizations/festivobg-ltd/issues/",
              icon: "🐛",
            },
            {
              label: "Upstash",
              hint: "Redis (rate limiting)",
              href: "https://console.upstash.com",
              icon: "⚡",
            },
            {
              label: "Supabase",
              hint: "База данни и auth",
              href: "https://supabase.com/dashboard",
              icon: "🗄️",
            },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              title={item.hint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-[#0c0e14] transition hover:border-black/[0.16] hover:bg-white hover:shadow-sm"
            >
              <span className="text-xs leading-none" aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
              <span className="text-[9px] text-black/30" aria-hidden>↗</span>
            </a>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5" aria-label="Бързи действия">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Бързи действия</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <li>
            <Link href="/admin/pending-festivals" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Чакащи фестивали
            </Link>
          </li>
          <li>
            <Link href="/admin/organizer-claims" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Заявки организатори
            </Link>
          </li>
          <li>
            <Link href="/admin/users" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Потребители
            </Link>
          </li>
          <li>
            <Link href="/admin/research" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Проучване (фестивал)
            </Link>
          </li>
          <li>
            <Link href="/admin/ingest" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Внасяне
            </Link>
          </li>
          <li>
            <Link href="/admin/discovery" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Открития
            </Link>
          </li>
          <li>
            <Link href="/admin/outbound" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Кликове (outbound)
            </Link>
          </li>
          <li>
            <Link href="/admin/notifications" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Push диагностика
            </Link>
          </li>
          <li>
            <Link href="/admin/observability" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Observability
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
