import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type SearchParams = Record<string, string | string[] | undefined>;
function asString(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const type = asString(params.type);
  const status = asString(params.status);
  const from = asString(params.from);
  const to = asString(params.to);

  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/notifications");
  }

  const supabase = createSupabaseAdmin();
  let q = supabase
    .from("push_delivery_audit")
    .select("id,notification_type,send_status,provider_response,created_at,opened_at");

  if (type) q = q.eq("notification_type", type);
  if (status) q = q.eq("send_status", status);
  if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
  if (to) q = q.lte("created_at", `${to}T23:59:59Z`);

  const [{ data: auditRows, error: auditErr }, { count: backlog }] = await Promise.all([
    q.order("created_at", { ascending: false }).limit(500),
    supabase.from("notification_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  if (auditErr) {
    return <div className="text-sm text-red-700">Неуспешно зареждане: {auditErr.message}</div>;
  }

  const rows = auditRows ?? [];
  const sent = rows.filter((r) => r.send_status === "sent").length;
  const failed = rows.filter((r) => r.send_status === "failed").length;
  const opened = rows.filter((r) => !!r.opened_at).length;
  const ctr = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0.0";
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.notification_type, (byType.get(r.notification_type) ?? 0) + 1);
  const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const lastErrors = rows
    .filter((r) => r.send_status === "failed")
    .slice(0, 20)
    .map((r) => ({
      created_at: r.created_at,
      type: r.notification_type,
      error:
        typeof r.provider_response === "object" && r.provider_response && "error" in r.provider_response
          ? String((r.provider_response as Record<string, unknown>).error)
          : JSON.stringify(r.provider_response).slice(0, 120),
    }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-5">
        <h1 className="text-2xl font-black tracking-tight">Push диагностика</h1>
        <p className="mt-1 text-sm text-black/60">Оперативен панел за push delivery, open tracking и опашката.</p>
        <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input name="type" defaultValue={type} placeholder="type" className="rounded border px-2 py-1.5 text-sm" />
          <select name="status" defaultValue={status} className="rounded border px-2 py-1.5 text-sm">
            <option value="">all statuses</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="skipped">skipped</option>
          </select>
          <input name="from" type="date" defaultValue={from} className="rounded border px-2 py-1.5 text-sm" />
          <input name="to" type="date" defaultValue={to} className="rounded border px-2 py-1.5 text-sm" />
          <button className="rounded bg-black px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Филтрирай
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat title="Sent" value={String(sent)} />
        <Stat title="Failed" value={String(failed)} />
        <Stat title="Opened" value={String(opened)} />
        <Stat title="CTR %" value={ctr} />
        <Stat title="Queue backlog" value={String(backlog ?? 0)} />
        <Stat title="Rows" value={String(rows.length)} />
      </div>

      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-4">
        <h2 className="text-lg font-black">Top notification types</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {topTypes.map(([t, c]) => (
            <li key={t} className="flex items-center justify-between border-b border-black/[0.05] py-1">
              <span className="font-mono text-xs">{t}</span>
              <span className="font-semibold">{c}</span>
            </li>
          ))}
          {topTypes.length === 0 ? <li className="text-black/50">Няма данни</li> : null}
        </ul>
      </div>

      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-4">
        <h2 className="text-lg font-black">Last errors</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.12em] text-black/50">
              <tr>
                <th className="py-2">Time</th>
                <th>Type</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {lastErrors.map((e, idx) => (
                <tr key={`${e.created_at}-${idx}`} className="border-t border-black/[0.06]">
                  <td className="py-2">{new Date(e.created_at).toLocaleString("bg-BG")}</td>
                  <td className="font-mono text-xs">{e.type}</td>
                  <td>{e.error}</td>
                </tr>
              ))}
              {lastErrors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-black/50">
                    Няма recent failures.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Link href="/admin" className="text-sm font-semibold hover:underline">
        ← Към админ таблото
      </Link>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">{title}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{value}</p>
    </div>
  );
}
