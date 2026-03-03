import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import PlanPageClient from "@/components/plan/PlanPageClient";
import { getOptionalUser } from "@/lib/authUser";
import { getPlanEntriesByUser, getPlanStateByUser } from "@/lib/plan/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "../landing.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlanPage() {
  noStore();
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h1 className="text-3xl font-black tracking-tight">Моят план</h1>
          <p className="mt-3 text-sm text-black/65">Влез, за да управляваш избраните събития и напомняния.</p>
          <Link href="/login" className="mt-4 inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white">
            Вход
          </Link>
        </div>
      </div>
    );
  }

  let isAdmin = false;
  const supabase = await createSupabaseServerClient();
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  isAdmin = Boolean(roleRow);

  const [entries, planState] = await Promise.all([getPlanEntriesByUser(), getPlanStateByUser()]);
  const festivalIds = Array.from(new Set(planState.festivalIds.map(String)));
  let festivals: Array<{
    id: string;
    slug: string;
    title: string;
    city: string | null;
    start_date: string | null;
    end_date: string | null;
  }> = [];

  if (festivalIds.length) {
    const { data: festivalRows } = await supabase
      .from("festivals")
      .select("id,slug,title,city,start_date,end_date")
      .in("id", festivalIds);

    festivals = (festivalRows ?? []).map((festival) => ({
      id: String(festival.id),
      slug: festival.slug,
      title: festival.title,
      city: festival.city,
      start_date: festival.start_date,
      end_date: festival.end_date,
    }));
  }

  return (
    <div className="landing-bg min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[1100px] space-y-5">
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h1 className="text-3xl font-black tracking-tight">Моят план</h1>
          <p className="mt-2 text-sm text-black/65">Предстоящи събития и напомняния.</p>
          {isAdmin ? (
            <Link
              href="/admin"
              className="mt-4 inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
            >
              Админ панел
            </Link>
          ) : null}
        </div>

        <PlanPageClient entries={entries} festivals={festivals} />
      </div>
    </div>
  );
}
