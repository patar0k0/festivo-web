import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";

type SearchParams = Record<string, string | string[] | undefined>;

type OutboundDetailRow = {
  id: string;
  created_at: string;
  festival_id: string | null;
  destination_type: string;
  source: string;
  festivals: { id: string; title: string | null } | null;
};

type AggRow = {
  festival_id: string | null;
  destination_type: string;
};

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

const TYPE_OPTIONS = ["", "booking", "ticket", "website", "maps", "accommodation", "instagram", "unknown"] as const;

function parseDaysParam(params: SearchParams): { periodDays: number | null; daysSelectValue: string } {
  const raw = params.days;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined) {
    return { periodDays: 7, daysSelectValue: "7" };
  }
  if (v === "") {
    return { periodDays: null, daysSelectValue: "" };
  }
  if (v === "7") {
    return { periodDays: 7, daysSelectValue: "7" };
  }
  if (v === "30") {
    return { periodDays: 30, daysSelectValue: "30" };
  }
  return { periodDays: 7, daysSelectValue: "7" };
}

function sinceIsoForPeriod(periodDays: number | null): string | null {
  if (periodDays === null) return null;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - periodDays);
  return since.toISOString();
}

type FestivalBuckets = {
  total: number;
  booking: number;
  maps: number;
  website: number;
  ticket: number;
};

function emptyBuckets(): FestivalBuckets {
  return { total: 0, booking: 0, maps: 0, website: 0, ticket: 0 };
}

function bumpBucket(b: FestivalBuckets, destinationType: string) {
  b.total += 1;
  const t = destinationType.toLowerCase();
  if (t === "booking") b.booking += 1;
  else if (t === "maps") b.maps += 1;
  else if (t === "website") b.website += 1;
  else if (t === "ticket") b.ticket += 1;
}

export default async function AdminOutboundPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await getAdminContext();
  if (!admin) {
    redirect("/login?next=/admin/outbound");
  }

  const params = await searchParams;
  const typeFilter = asString(params.type).trim();
  const { periodDays, daysSelectValue } = parseDaysParam(params);
  const sinceIso = sinceIsoForPeriod(periodDays);

  const supabase = admin.supabase;

  function applyDateRange<T extends { gte: (c: string, v: string) => T }>(q: T): T {
    if (!sinceIso) return q;
    return q.gte("created_at", sinceIso);
  }

  const [
    { count: totalCount, error: errTotal },
    { count: bookingCount, error: errBooking },
    { count: mapsCount, error: errMaps },
    { count: websiteCount, error: errWebsite },
    { count: ticketCount, error: errTicket },
    { data: aggRows, error: errAgg },
  ] = await Promise.all([
    (() => {
      let q = supabase.from("outbound_clicks").select("*", { count: "exact", head: true });
      q = applyDateRange(q);
      return q;
    })(),
    (() => {
      let q = supabase.from("outbound_clicks").select("*", { count: "exact", head: true }).eq("destination_type", "booking");
      q = applyDateRange(q);
      return q;
    })(),
    (() => {
      let q = supabase.from("outbound_clicks").select("*", { count: "exact", head: true }).eq("destination_type", "maps");
      q = applyDateRange(q);
      return q;
    })(),
    (() => {
      let q = supabase.from("outbound_clicks").select("*", { count: "exact", head: true }).eq("destination_type", "website");
      q = applyDateRange(q);
      return q;
    })(),
    (() => {
      let q = supabase.from("outbound_clicks").select("*", { count: "exact", head: true }).eq("destination_type", "ticket");
      q = applyDateRange(q);
      return q;
    })(),
    (() => {
      let q = supabase.from("outbound_clicks").select("festival_id, destination_type");
      q = applyDateRange(q);
      return q;
    })(),
  ]);

  const countError = errTotal ?? errBooking ?? errMaps ?? errWebsite ?? errTicket ?? errAgg;

  const aggData = (aggRows ?? []) as AggRow[];
  const byFestival = new Map<string, FestivalBuckets>();
  for (const row of aggData) {
    if (!row.festival_id) continue;
    const id = row.festival_id;
    if (!byFestival.has(id)) byFestival.set(id, emptyBuckets());
    bumpBucket(byFestival.get(id)!, row.destination_type);
  }

  const topFestivalIds = [...byFestival.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([id]) => id);

  const titleById = new Map<string, string>();
  if (topFestivalIds.length) {
    const { data: festRows } = await supabase.from("festivals").select("id, title").in("id", topFestivalIds);
    for (const f of festRows ?? []) {
      titleById.set(f.id, typeof f.title === "string" ? f.title : "");
    }
  }

  const topRows = topFestivalIds.map((id) => ({
    id,
    title: titleById.get(id)?.trim() || "Unknown festival",
    ...byFestival.get(id)!,
  }));

  let detailQuery = supabase
    .from("outbound_clicks")
    .select("id, created_at, festival_id, destination_type, source, festivals(id, title)");

  if (typeFilter) {
    detailQuery = detailQuery.eq("destination_type", typeFilter);
  }
  detailQuery = applyDateRange(detailQuery);
  detailQuery = detailQuery.order("created_at", { ascending: false }).limit(100);

  const { data: detailData, error: detailError } = await detailQuery;
  const rows = (detailData ?? []) as OutboundDetailRow[];

  const listError = detailError ?? countError;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Външни кликове</h1>
        <p className="mt-2 text-sm text-black/65">
          Обобщение за периода, топ фестивали и последни записи (макс. 100 реда в таблицата по-долу).
        </p>
        <div className="mt-4">
          <Link href="/admin" className="text-sm font-semibold text-[#0c0e14] hover:underline">
            ← Табло
          </Link>
        </div>

        <form className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" method="get">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Тип дестинация
            <select
              name="type"
              defaultValue={typeFilter}
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((v) => (
                <option key={v || "all"} value={v}>
                  {v === "" ? "Всички" : v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Период
            <select
              name="days"
              defaultValue={daysSelectValue}
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
            >
              <option value="">Всички</option>
              <option value="7">Последни 7 дни</option>
              <option value="30">Последни 30 дни</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#1d202b]"
            >
              Приложи
            </button>
          </div>
        </form>

        {listError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-800" role="alert">
            {listError.message}
          </p>
        ) : null}
      </div>

      {!listError ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Общо кликове</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{totalCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Booking</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{bookingCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Maps</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{mapsCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Website</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{websiteCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Ticket</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{ticketCount ?? 0}</p>
          </div>
        </div>
      ) : null}

      {!listError ? (
        <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/90 shadow-[0_2px_0_rgba(12,14,20,0.04)]">
          <div className="border-b border-black/[0.08] bg-black/[0.02] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#0c0e14]">Топ фестивали (до 20)</h2>
            <p className="mt-0.5 text-xs text-black/50">По общ брой кликове за избрания период (без филтър по тип).</p>
          </div>
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] bg-black/[0.02] text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                <th className="px-4 py-3">Фестивал</th>
                <th className="px-4 py-3">Общо</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Maps</th>
                <th className="px-4 py-3">Website</th>
                <th className="px-4 py-3">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {topRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-black/55">
                    Няма кликове с избран фестивал за периода.
                  </td>
                </tr>
              ) : (
                topRows.map((r) => (
                  <tr key={r.id} className="border-b border-black/[0.06] last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/festivals/${r.id}`} className="font-medium text-[#0c0e14] hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-black/85">{r.total}</td>
                    <td className="px-4 py-2.5 tabular-nums text-black/70">{r.booking}</td>
                    <td className="px-4 py-2.5 tabular-nums text-black/70">{r.maps}</td>
                    <td className="px-4 py-2.5 tabular-nums text-black/70">{r.website}</td>
                    <td className="px-4 py-2.5 tabular-nums text-black/70">{r.ticket}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/90 shadow-[0_2px_0_rgba(12,14,20,0.04)]">
        <div className="border-b border-black/[0.08] bg-black/[0.02] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#0c0e14]">Последни записи</h2>
          <p className="mt-0.5 text-xs text-black/50">С филтрите по тип и период (макс. 100).</p>
        </div>
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.08] bg-black/[0.02] text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
              <th className="px-4 py-3">created_at</th>
              <th className="px-4 py-3">Фестивал</th>
              <th className="px-4 py-3">destination_type</th>
              <th className="px-4 py-3">source</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-black/55">
                  Няма записи за избраните филтри.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const title = row.festivals?.title?.trim();
                const showUnknown = !row.festival_id;
                const showMissingTitle = Boolean(row.festival_id) && !title;
                return (
                  <tr key={row.id} className="border-b border-black/[0.06] last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-black/80">
                      {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="max-w-[min(28rem,90vw)] px-4 py-2.5">
                      {showUnknown ? (
                        <span className="text-black/45">Unknown festival</span>
                      ) : showMissingTitle ? (
                        <span className="text-black/55">Unknown festival</span>
                      ) : (
                        <Link
                          href={`/admin/festivals/${row.festival_id}`}
                          className="font-medium text-[#0c0e14] hover:underline"
                        >
                          {title}
                        </Link>
                      )}
                      {row.festival_id ? (
                        <span className="mt-0.5 block font-mono text-[10px] leading-tight text-black/35">{row.festival_id}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-black/85">{row.destination_type}</td>
                    <td className="px-4 py-2.5 text-black/70">{row.source}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
