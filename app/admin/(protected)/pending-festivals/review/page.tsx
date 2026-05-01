import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PendingFestivalFastReview from "@/components/admin/PendingFestivalFastReview";

export default async function AdminPendingFestivalsFastReviewPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/pending-festivals/review");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Fast review</h1>
          <p className="mt-2 text-sm text-black/65">
            One festival at a time — keyboard shortcuts for speed. Table view remains on{" "}
            <Link href="/admin/pending-festivals" className="font-semibold underline decoration-black/25 underline-offset-2">
              Pending festivals
            </Link>
            .
          </p>
        </div>
      </div>

      <PendingFestivalFastReview />
    </div>
  );
}
