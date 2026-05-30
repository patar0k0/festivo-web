import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import CategoriesManager from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) redirect("/login?next=/admin");

  const admin = createSupabaseAdmin();
  const [catResult, countResult] = await Promise.all([
    admin
      .from("festival_categories")
      .select("slug,label_bg,sort_order,is_active")
      .order("sort_order", { ascending: true })
      .order("label_bg", { ascending: true }),
    admin
      .from("festivals")
      .select("category")
      .not("category", "is", null)
      .neq("status", "archived"),
  ]);

  const counts: Record<string, number> = {};
  for (const row of countResult.data ?? []) {
    const c = typeof row.category === "string" ? row.category.trim() : "";
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }

  const categories = (catResult.data ?? []).map((cat) => ({
    ...cat,
    festival_count: counts[cat.slug] ?? 0,
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[#0c0e14]">Категории на фестивали</h1>
        <p className="mt-1 text-sm text-black/55">
          Управлявай списъка с категории. Slug-ът се генерира от лейбъла и е постоянен — съхранява се директно в{" "}
          <code className="rounded bg-black/5 px-1 font-mono text-xs">festivals.category</code>.
        </p>
      </div>
      <CategoriesManager initial={categories} />
    </div>
  );
}
