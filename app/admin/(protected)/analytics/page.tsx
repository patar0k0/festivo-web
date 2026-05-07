import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";

export const dynamic = "force-dynamic";

type EmailJobAnalyticsRow = {
  type: string | null;
  payload: { type?: string } | null;
  created_at: string | null;
};

export default async function AdminAnalyticsPage() {
  const admin = await getAdminContext();
  if (!admin) {
    redirect("/login?next=/admin/analytics");
  }

  const { data, error } = await admin.supabase
    .from("email_jobs")
    .select("type, payload, created_at")
    .in("type", ["promotion-request", "analytics-event"]);

  if (error) {
    throw error;
  }

  let promotionRequests = 0;
  let benefitsClicks = 0;
  let promotionClicks = 0;

  for (const row of (data ?? []) as EmailJobAnalyticsRow[]) {
    if (row.type === "promotion-request") {
      promotionRequests += 1;
    }

    if (row.type === "analytics-event") {
      if (row.payload?.type === "click-benefits") {
        benefitsClicks += 1;
      }
      if (row.payload?.type === "click-promotion-request") {
        promotionClicks += 1;
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="mb-6 text-xl font-semibold">Анализ на монетизация</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Заявки за промо</p>
          <p className="text-xl font-semibold">{promotionRequests}</p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Кликове „Научи повече“</p>
          <p className="text-xl font-semibold">{benefitsClicks}</p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Кликове „Заяви промо“</p>
          <p className="text-xl font-semibold">{promotionClicks}</p>
        </div>
      </div>
    </div>
  );
}
