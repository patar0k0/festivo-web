import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import EnrichmentProposalActions from "@/components/admin/EnrichmentProposalActions";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  description: "Описание",
  facebook_url: "Facebook",
  website_url: "Уебсайт",
  instagram_url: "Instagram",
  ticket_url: "Билети",
  location_name: "Място",
  address: "Адрес",
  is_free: "Безплатен",
  category: "Категория",
};

export default async function EnrichmentProposalDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/enrichment-proposals/${params.id}`);
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("festival_enrichment_proposals")
    .select(
      "id,status,patch_json,created_at,reviewed_at,target_festival_id,festivals(id,name,start_date,description,facebook_url,website_url,instagram_url,ticket_url,location_name,address,is_free,category)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>
    );
  }
  if (!data) notFound();

  const patch = (data.patch_json ?? {}) as Record<string, unknown>;
  const festival = data.festivals as unknown as Record<string, unknown> | null;
  const isPending = data.status === "pending";

  return (
    <div className="space-y-8 px-4 py-8 text-[#0c0e14] md:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Админ › Предложения</p>
        <h1 className="mt-1 text-2xl font-bold">Предложение за обогатяване</h1>
        <div className="mt-2 flex items-center gap-3">
          {festival && (
            <Link
              href={`/admin/festivals/${festival.id}`}
              className="text-sm font-semibold underline hover:opacity-75"
            >
              {String(festival.name ?? festival.id)}
            </Link>
          )}
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              data.status === "pending"
                ? "border border-amber-200 bg-amber-50 text-amber-800"
                : data.status === "approved"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {data.status === "pending" ? "Чакащо" : data.status === "approved" ? "Одобрено" : "Отхвърлено"}
          </span>
        </div>
        <Link href="/admin/enrichment-proposals" className="mt-2 inline-block text-sm text-black/50 underline">
          ← Всички предложения
        </Link>
      </div>

      {/* Fields comparison table */}
      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-sm">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.12em] text-black/50">
            <tr>
              <th className="px-4 py-3">Поле</th>
              <th className="px-4 py-3">Текуща стойност</th>
              <th className="px-4 py-3">От плакат</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {Object.entries(patch).map(([field, proposed]) => {
              const current = festival?.[field];
              const isEmpty = current === null || current === undefined || current === "";
              return (
                <tr key={field}>
                  <td className="px-4 py-3 font-medium">{FIELD_LABELS[field] ?? field}</td>
                  <td className="max-w-[300px] px-4 py-3 text-black/45">
                    {isEmpty ? (
                      <span className="italic">празно</span>
                    ) : (
                      <span className="whitespace-pre-wrap break-words text-xs">{String(current)}</span>
                    )}
                  </td>
                  <td className="max-w-[300px] px-4 py-3">
                    <span className="whitespace-pre-wrap break-words rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900 ring-1 ring-emerald-200">
                      {String(proposed)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isPending ? (
        <EnrichmentProposalActions proposalId={data.id} />
      ) : (
        <p className="text-sm text-black/50">
          Прегледано на {data.reviewed_at ? new Date(data.reviewed_at).toLocaleString("bg-BG") : "—"}
        </p>
      )}
    </div>
  );
}
