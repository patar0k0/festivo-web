import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import PlanPageClient from "@/components/plan/PlanPageClient";
import { getOptionalUser } from "@/lib/authUser";
import { getPlanEntriesByUser, getPlanStateByUser } from "@/lib/plan/server";
import { formatSettlementDisplayName } from "@/lib/settlements/formatDisplayName";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "../landing.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseDateSafe(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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

  const supabase = await createSupabaseServerClient();
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
      .select("id,slug,title,city,start_date,end_date,cities:cities!left(name_bg,is_village)")
      .in("id", festivalIds);

    festivals = (festivalRows ?? []).map((row) => {
      const rawJoin = row.cities as { name_bg?: string | null; is_village?: boolean | null } | null | undefined;
      const joined = Array.isArray(rawJoin) ? rawJoin[0] : rawJoin;
      return {
        id: String(row.id),
        slug: row.slug,
        title: row.title,
        city:
          formatSettlementDisplayName(joined?.name_bg ?? row.city, joined?.is_village ?? undefined) ??
          (row.city ? fixMojibakeBG(row.city) : null),
        start_date: row.start_date,
        end_date: row.end_date,
      };
    });
  }

  const activeReminderCount = Object.values(planState.reminders).filter((reminder) => reminder !== "none").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextUpcomingFestival =
    festivals
      .map((festival) => ({ ...festival, parsedStartDate: parseDateSafe(festival.start_date) }))
      .filter((festival) => festival.parsedStartDate && festival.parsedStartDate >= today)
      .sort((a, b) => a.parsedStartDate!.getTime() - b.parsedStartDate!.getTime())[0] ?? null;

  return (
    <div className="landing-bg min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[1100px]">
        <PlanPageClient
          entries={entries}
          festivals={festivals}
          summary={{
            savedFestivalCount: festivalIds.length,
            activeReminderCount,
            nextUpcomingFestival: nextUpcomingFestival
              ? {
                  title: nextUpcomingFestival.title,
                  startDate: nextUpcomingFestival.start_date,
                  endDate: nextUpcomingFestival.end_date,
                }
              : null,
          }}
        />
      </div>
    </div>
  );
}
