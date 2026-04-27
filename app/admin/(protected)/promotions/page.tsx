import PromotionsOverviewClient from "@/components/admin/PromotionsOverviewClient";
import { normalizePromotedRows, type PromotedFestivalRaw } from "@/lib/admin/promotionsOverview";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { redirect } from "next/navigation";

export default async function AdminPromotionsPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/promotions");
  }

  const { data, error } = await ctx.supabase
    .from("festivals")
    .select(
      `
    id,
    title,
    slug,
    promotion_status,
    promotion_expires_at,
    promotion_rank,
    organizer:organizers!left (
      id,
      name
    )
  `,
    )
    .eq("promotion_status", "promoted")
    .order("promotion_expires_at", { ascending: true });

  if (error) {
    console.error("[admin/promotions] festivals query failed", error.message);
    throw new Error(`Failed to load promoted festivals: ${error.message}`);
  }

  const rows = normalizePromotedRows((data ?? []) as PromotedFestivalRaw[]);

  return (
    <div className="space-y-3">
      <h1 className="mb-4 text-xl font-semibold">Промотирани фестивали</h1>
      <PromotionsOverviewClient data={rows} />
    </div>
  );
}
