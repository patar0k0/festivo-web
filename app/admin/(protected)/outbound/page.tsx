import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";

type SearchParams = Record<string, string | string[] | undefined>;

type OutboundRow = {
  id: string;
  created_at: string;
  festival_id: string | null;
  destination_type: string;
  source: string;
};

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

const TYPE_OPTIONS = ["", "booking", "ticket", "website", "maps", "accommodation", "instagram", "unknown"] as const;

export default async function AdminOutboundPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await getAdminContext();
  if (!admin) {
    redirect("/login?next=/admin/outbound");
  }

  const params = await searchParams;
  const typeFilter = asString(params.type).trim();
  const daysRaw = asString(params.days);
  const days = daysRaw === "7" ? 7 : daysRaw === "30" ? 30 : null;

  let query = admin.supabase.from("outbound_clicks").select("id, created_at, festival_id, destination_type, source");

  if (typeFilter) {
    query = query.eq("destination_type", typeFilter);
  }

  if (days !== null) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    query = query.gte("created_at", since.toISOString());
  }

  query = query.order("created_at", { ascending: false }).limit(100);

  const { data, error } = await query;
  const rows = (data ?? []) as OutboundRow[];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Външни кликове</h1>
        <p className="mt-2 text-sm text-black/65">
          Последни записи от пренасочвания към сайтове, билети, карти и настаняване (макс. 100 реда).
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
              defaultValue={daysRaw === "7" || daysRaw === "30" ? daysRaw : ""}
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

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-800" role="alert">
            {error.message}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/90 shadow-[0_2px_0_rgba(12,14,20,0.04)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.08] bg-black/[0.02] text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
              <th className="px-4 py-3">created_at</th>
              <th className="px-4 py-3">festival_id</th>
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
              rows.map((row) => (
                <tr key={row.id} className="border-b border-black/[0.06] last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-black/80">
                    {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 font-mono text-xs text-black/70">
                    {row.festival_id ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-black/85">{row.destination_type}</td>
                  <td className="px-4 py-2.5 text-black/70">{row.source}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
