import Link from "next/link";
import { redirect } from "next/navigation";
import FestivalDuplicatesTable from "@/components/admin/FestivalDuplicatesTable";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildDuplicateRows, type FestivalRow, type FestivalDuplicateRow } from "@/lib/admin/festivalDuplicates";

export type { FestivalDuplicateRow } from "@/lib/admin/festivalDuplicates";

export default async function FestivalDuplicatesPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/festivals/duplicates");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin/festivals/duplicates/page] Admin client init failed", { message });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Услугата е временно недостъпна.
      </div>
    );
  }

  const { data, error } = await adminClient
    .from("festivals")
    .select("id,title,slug,start_date,city_id,cities:cities!festivals_city_id_fkey(name_bg),status")
    .neq("status", "archived")
    .order("title", { ascending: true })
    .returns<(Omit<FestivalRow, "city_name"> & { cities: { name_bg: string | null } | null })[]>();

  if (error) {
    console.error("[admin/festivals/duplicates/page] query failed", { message: error.message });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        {error.message}
      </div>
    );
  }

  const rows: FestivalRow[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    start_date: r.start_date,
    city_id: r.city_id,
    city_name: r.cities?.name_bg ?? null,
    status: r.status,
  }));

  const duplicateRows = buildDuplicateRows(rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Дублирани фестивали</h1>
          <p className="mt-1 text-sm text-black/65">
            Кандидати за дублиране по нормализирано заглавие, дата и град.{" "}
            <span className="font-medium">{duplicateRows.length} двойки</span> от{" "}
            <span className="font-medium">{rows.length} фестивала</span>.
          </p>
        </div>
        <Link
          href="/admin/festivals"
          className="rounded-lg border border-black/[0.12] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
        >
          Назад
        </Link>
      </div>

      <FestivalDuplicatesTable rows={duplicateRows} />
    </div>
  );
}
