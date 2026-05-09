import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { getRuntimeEventStats, getRuntimeEvents } from "@/lib/observability/runtimeStore";

export const dynamic = "force-dynamic";

function formatMeta(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return "{}";
  }
}

export default async function AdminObservabilityPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/observability");
  }

  const stats = getRuntimeEventStats();
  const stored = getRuntimeEvents();
  const recent = stored.slice(0, 80);
  const bufferSize = stored.length;

  const card = "rounded-xl border border-black/[0.08] bg-white/80 p-4";
  const kpiClass =
    "flex flex-col rounded-xl border border-black/[0.08] bg-white/80 p-3 transition-colors hover:border-black/[0.14] hover:bg-white";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Админ</p>
        <h1 className="mt-1 text-xl font-bold text-[#0c0e14] md:text-2xl">Observability</h1>
        <p className="mt-1 max-w-2xl text-sm text-black/55">
          In-memory structured events from this server instance (ring buffer, last 500). Rolling 24h stats below. Not shared
          across Vercel instances.
        </p>
        <p className="mt-2 text-xs text-black/45">
          <Link href="/admin" className="font-semibold text-[#0c0e14] underline-offset-2 hover:underline">
            ← Табло
          </Link>
        </p>
      </div>

      <section aria-label="Обобщение" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className={kpiClass}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Събития (24ч)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{stats.total24h}</p>
        </div>
        <div className={kpiClass}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Грешки (24ч)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#b13a1a]">{stats.errors24h}</p>
        </div>
        <div className={kpiClass}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Предупреждения (24ч)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#9a6b16]">{stats.warnings24h}</p>
        </div>
        <div className={kpiClass}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Буфер (инстанция)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{bufferSize}</p>
          <p className="mt-0.5 text-[11px] text-black/45">до 500 записа</p>
        </div>
      </section>

      <section className={card} aria-label="Top events">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Top events (24ч)</p>
        <h2 className="mt-1 text-sm font-semibold text-[#0c0e14]">Най-чести събития</h2>
        {stats.topEvents.length === 0 ? (
          <p className="mt-3 text-sm text-black/50">Няма записи за последните 24 часа.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/[0.06] text-sm">
            {stats.topEvents.map((row) => (
              <li key={row.event} className="flex items-baseline justify-between gap-2 py-2">
                <span className="font-mono text-xs text-[#0c0e14]">{row.event}</span>
                <span className="tabular-nums font-semibold text-black/70">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-label="Recent events">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Последни</p>
        <h2 className="mt-1 text-sm font-semibold text-[#0c0e14]">Скорошни събития</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-black/[0.06]">
          <table className="min-w-full divide-y divide-black/[0.06] text-sm">
            <thead className="bg-black/[0.02] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">
              <tr>
                <th className="px-3 py-2">Ниво</th>
                <th className="px-3 py-2">Събитие</th>
                <th className="px-3 py-2">Час</th>
                <th className="px-3 py-2 hidden lg:table-cell">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-black/50">
                    Няма записи в буфера.
                  </td>
                </tr>
              ) : (
                recent.map((row, idx) => (
                  <tr key={`${row.ts}-${row.event}-${idx}`} className="text-[#0c0e14]">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      <span
                        className={
                          row.level === "error"
                            ? "text-[#b13a1a]"
                            : row.level === "warn"
                              ? "text-[#9a6b16]"
                              : "text-black/70"
                        }
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 font-mono text-xs">{row.event}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-xs text-black/65">{row.ts}</td>
                    <td className="hidden max-w-xl px-3 py-2 font-mono text-[11px] text-black/60 lg:table-cell">
                      <span className="line-clamp-2" title={formatMeta(row.meta)}>
                        {formatMeta(row.meta)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
