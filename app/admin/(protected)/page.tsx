import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { formatDateValueAsDdMmYyyy } from "@/lib/dates/euDateFormat";

type FestivalStatus = "draft" | "verified" | "rejected" | "archived";

async function getStatusCount(
  supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"] | null,
  status: FestivalStatus
) {
  if (!supabase) return 0;
  const { count } = await supabase.from("festivals").select("id", { count: "exact", head: true }).eq("status", status);
  return count ?? 0;
}

async function getPendingCount(supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"] | null) {
  if (!supabase) return 0;
  const { count } = await supabase.from("pending_festivals").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}

async function getDiscoveryRecentCount(
  supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"] | null
) {
  if (!supabase) return 0;
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { count } = await supabase
    .from("discovered_links")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
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

function normalizeCityName(city: PendingQueueDbRow["city"]): string | null {
  if (!city) return null;
  const row = Array.isArray(city) ? city[0] : city;
  return row?.name_bg?.trim() || null;
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

async function loadPendingQueue(
  supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"] | null
): Promise<PendingQueueDbRow[]> {
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

export default async function AdminDashboardPage() {
  const admin = await getAdminContext();
  const supabase = admin?.supabase ?? null;

  const [pending, draft, verified, rejected, archived, discoveryRecent, queueRows] = await Promise.all([
    getPendingCount(supabase),
    getStatusCount(supabase, "draft"),
    getStatusCount(supabase, "verified"),
    getStatusCount(supabase, "rejected"),
    getStatusCount(supabase, "archived"),
    getDiscoveryRecentCount(supabase),
    loadPendingQueue(supabase),
  ]);

  const festivalStats = [
    { label: "Чернова", value: draft, href: "/admin/festivals?status=draft", hint: "фестивали" },
    { label: "Потвърдени", value: verified, href: "/admin/festivals?status=verified", hint: "фестивали" },
    { label: "Отхвърлени", value: rejected, href: "/admin/festivals?status=rejected", hint: "фестивали" },
    { label: "Архивирани", value: archived, href: "/admin/festivals?status=archived", hint: "фестивали" },
  ] as const;

  const kpiCardClass =
    "flex flex-col rounded-xl border border-black/[0.08] bg-white/80 p-3 transition-colors hover:border-black/[0.14] hover:bg-white";

  const pendingNoun = pending === 1 ? "чакащ фестивал" : "чакащи фестивала";

  return (
    <div className="space-y-4">
      {/* Priority bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white/80 px-3 py-2.5 md:px-4">
        <p className="text-sm font-medium text-[#0c0e14]">
          <span className="tabular-nums font-semibold">{pending}</span>{" "}
          <span className="text-black/60">{pendingNoun}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {discoveryRecent > 0 ? (
            <Link
              href="/admin/discovery"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45 underline-offset-2 transition hover:text-[#0c0e14] hover:underline"
            >
              {discoveryRecent} нови открития (7 дни)
            </Link>
          ) : null}
          <Link
            href="/admin/pending-festivals"
            className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#1d202b]"
          >
            Прегледай
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Link
          href="/admin/pending-festivals"
          className={`${kpiCardClass} ${pending > 0 ? "border-[#d4a017]/30 bg-[#fffbeb]/70" : ""}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Чакащи</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{pending}</p>
          <p className="mt-0.5 text-[11px] text-black/45">Към опашката →</p>
        </Link>

        {festivalStats.map((item) => (
          <Link key={item.label} href={item.href} className={kpiCardClass}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{item.value}</p>
            <p className="mt-0.5 text-[11px] text-black/45">{item.hint} · филтър →</p>
          </Link>
        ))}
      </div>

      {/* Main work queue */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#0c0e14]">Последни чакащи фестивали</h2>
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
                <th className="px-3 py-2">Източник</th>
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
                  const linkClass =
                    "rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition hover:bg-black/[0.04]";
                  return (
                    <tr key={id} className="text-[#0c0e14]">
                      <td className="max-w-[min(28rem,40vw)] px-3 py-2">
                        <Link href={detailBase} className="font-medium text-[#0c0e14] hover:underline" title={title}>
                          {title.length > 80 ? `${title.slice(0, 77)}…` : title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-black/75">{city}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black/75">{dateLabel}</td>
                      <td className="max-w-[12rem] px-3 py-2 text-xs text-black/65" title={sourceLabel}>
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
      </section>

      {/* Quick actions — compact secondary */}
      <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Бързи действия</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <li>
            <Link href="/admin/research" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Проучване на фестивал (AI)
            </Link>
          </li>
          <li>
            <Link href="/admin/ingest" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Внасяне на данни
            </Link>
          </li>
          <li>
            <Link href="/admin/discovery" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Открития
            </Link>
          </li>
          <li>
            <Link href="/admin/organizers/research" className="font-medium text-[#0c0e14] underline-offset-2 hover:underline">
              Нов организатор (AI)
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
