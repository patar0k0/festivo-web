import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
import { getAdminContext } from "@/lib/admin/isAdmin";
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

  const [
    pending,
    draft,
    verified,
    rejected,
    archived,
    discoveryRecent,
    queueRows,
    orgQueueRows,
    organizersTotal,
    organizersVerified,
    organizersUnverified,
    pendingOrgClaims,
  ] = await Promise.all([
    getPendingCount(supabase),
    getStatusCount(supabase, "draft"),
    getStatusCount(supabase, "verified"),
    getStatusCount(supabase, "rejected"),
    getStatusCount(supabase, "archived"),
    getDiscoveryRecentCount(supabase),
    loadPendingQueue(supabase),
    loadPendingOrganizerClaimsQueue(supabase),
    getActiveOrganizersCount(supabase),
    getVerifiedOrganizersCount(supabase),
    getUnverifiedOrganizersCount(supabase),
    getPendingOrganizerClaimsCount(supabase),
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

  const linkClass =
    "rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition hover:bg-black/[0.04]";

  const domainCardClass = "rounded-xl border border-black/[0.08] bg-white/80 p-4";

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
            <p className="mt-0.5 text-[11px] text-black/45">Към опашката →</p>
          </Link>

          <Link
            href="/admin/organizer-claims"
            className={`${kpiCardClass} ${priorityHighlight(pendingOrgClaims > 0)}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Заявки организатори</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{pendingOrgClaims}</p>
            <p className="mt-0.5 text-[11px] text-black/45">Чакащи заявки / claims →</p>
          </Link>

          <Link href="/admin/discovery" className={kpiCardClass}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Нови открития (7 дни)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{discoveryRecent}</p>
            <p className="mt-0.5 text-[11px] text-black/45">Открития →</p>
          </Link>

          <Link href="/admin/festivals?status=draft" className={`${kpiCardClass} ${priorityHighlight(draft > 0)}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Чернови в каталога</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{draft}</p>
            <p className="mt-0.5 text-[11px] text-black/45">Фестивали (чернова) →</p>
          </Link>
        </div>
      </section>

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
                Проучване на фестивал (AI)
              </Link>
            </li>
            <li>
              <Link href="/admin/organizers/research" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
                Нов организатор (AI)
              </Link>
            </li>
          </ul>
        </section>
      </div>

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
        </ul>
      </section>
    </div>
  );
}
