import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "Чакащо",
  approved: "Одобрено",
  rejected: "Отхвърлено",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
};

export default async function EnrichmentProposalsPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/enrichment-proposals");
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("festival_enrichment_proposals")
    .select("id,status,patch_json,created_at,reviewed_at,target_festival_id,festivals(id,title,start_date)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6 px-4 py-8 text-[#0c0e14] md:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Админ</p>
        <h1 className="mt-1 text-2xl font-bold">Предложения за обогатяване</h1>
        <p className="mt-2 max-w-2xl text-sm text-black/60">
          Данни от плакати, предложени за добавяне към публикувани фестивали. Само незапълнени полета се попълват.
        </p>
      </div>

      {!rows.length ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center text-sm text-black/55">
          Няма предложения за обогатяване.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-sm">
          <table className="min-w-full divide-y divide-black/[0.08] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.12em] text-black/50">
              <tr>
                <th className="px-4 py-3">Фестивал</th>
                <th className="px-4 py-3">Полета</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Добавено</th>
                <th className="px-4 py-3">Прегледано</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {rows.map((row) => {
                const festival = row.festivals as { id?: string; title?: string; start_date?: string } | null;
                const patch = row.patch_json as Record<string, unknown> | null;
                const fields = patch ? Object.keys(patch).join(", ") : "—";
                const statusLabel = STATUS_LABELS[row.status] ?? row.status;
                const statusClass = STATUS_CLASSES[row.status] ?? "";
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      {festival ? (
                        <Link
                          href={`/admin/festivals/${festival.id}`}
                          className="font-medium underline hover:opacity-75"
                        >
                          {festival.title ?? festival.id}
                        </Link>
                      ) : (
                        <span className="text-black/40">—</span>
                      )}
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <span className="text-xs text-black/65">{fields}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55">
                      {row.created_at ? new Date(row.created_at).toLocaleString("bg-BG") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55">
                      {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString("bg-BG") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/enrichment-proposals/${row.id}`}
                        className="inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.03]"
                      >
                        Преглед
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
