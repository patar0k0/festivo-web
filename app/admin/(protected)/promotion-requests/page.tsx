import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PromotionRequestsTableClient, { type PromotionRequestRow } from "@/components/admin/PromotionRequestsTableClient";

export default async function AdminPromotionRequestsPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/promotion-requests");
  }

  const supabase = ctx.supabase;
  const { data, error } = await supabase
    .from("email_jobs")
    .select("id, payload, created_at")
    .eq("type", "promotion-request")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/promotion-requests] email_jobs query failed", error.message);
    throw new Error(`Failed to load promotion requests: ${error.message}`);
  }

  const rows: PromotionRequestRow[] = (data ?? []).map((r) => ({
    id: r.id,
    festivalId: r.payload?.festivalId ?? "",
    festivalTitle: r.payload?.festivalTitle,
    organizerName: r.payload?.organizerName,
    userEmail: r.payload?.userEmail,
    city: r.payload?.city,
    startDate: r.payload?.startDate,
    createdAt: r.created_at,
  }));

  return (
    <div className="space-y-3">
      <h1 className="mb-4 text-xl font-semibold">Заявки за промотиране</h1>
      <p className="text-sm text-gray-600">
        Свържи се с организатора, договори цена и активирай промоцията ръчно.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Няма заявки</p>
      ) : (
        <PromotionRequestsTableClient rows={rows} />
      )}
    </div>
  );
}
