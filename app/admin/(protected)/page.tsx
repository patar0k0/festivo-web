import Link from "next/link";
import { getAdminContext } from "@/lib/admin/isAdmin";

type FestivalStatus = "draft" | "verified" | "rejected" | "archived";

async function getStatusCount(
  supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"] | null,
  status: FestivalStatus
) {
  if (!supabase) return 0;
  const { count } = await supabase.from("festivals").select("id", { count: "exact", head: true }).eq("status", status);
  return count ?? 0;
}

export default async function AdminDashboardPage() {
  const admin = await getAdminContext();
  const supabase = admin?.supabase ?? null;

  const [draft, verified, rejected, archived] = await Promise.all([
    getStatusCount(supabase, "draft"),
    getStatusCount(supabase, "verified"),
    getStatusCount(supabase, "rejected"),
    getStatusCount(supabase, "archived"),
  ]);

  const stats = [
    { label: "Draft", value: draft },
    { label: "Verified", value: verified },
    { label: "Rejected", value: rejected },
    { label: "Archived", value: archived },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-black/65">Управлявай фестивалите, статусите и основните метаданни.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
          <Link href="/admin/festivals" className="rounded-xl bg-[#0c0e14] px-4 py-2 text-white hover:bg-[#1d202b]">
            Към фестивали
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">{item.label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
