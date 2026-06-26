import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import CitiesManager from "@/components/admin/CitiesManager";
import type { AdminCityRow } from "@/app/admin/api/cities/route";

export const dynamic = "force-dynamic";

export default async function AdminCitiesPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) redirect("/login?next=/admin");

  const admin = createSupabaseAdmin();
  const { data } = await admin.from("cities").select("id,name_bg,slug,region,is_village");

  const cities = ((data ?? []) as AdminCityRow[]).sort((a, b) =>
    a.name_bg.localeCompare(b.name_bg, "bg-BG"),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[#0c0e14]">Населени места</h1>
        <p className="mt-1 text-sm text-black/55">
          Управлявай тип град/село за всяко населено място (
          <code className="rounded bg-black/5 px-1 font-mono text-xs">cities.is_village</code>
          ). „Без тип" означава курорт/местност — без префикс на сайта.
        </p>
      </div>
      <CitiesManager initial={cities} />
    </div>
  );
}
