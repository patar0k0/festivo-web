import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import PlanPageClient from "@/components/plan/PlanPageClient";
import { pub } from "@/lib/public-ui/styles";
import { getOptionalUser } from "@/lib/authUser";
import { cn } from "@/lib/utils";
import { getPlanEntriesByUser, getPlanStateByUser } from "@/lib/plan/server";
import { festivalSettlementDisplayText } from "@/lib/settlements/formatDisplayName";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FestivalDateFields } from "@/lib/festival/listingDates";
import { festivalEffectiveCalendarBounds, getFestivalTemporalState } from "@/lib/festival/temporal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function planFestivalSortKey(f: FestivalDateFields): string {
  const bounds = festivalEffectiveCalendarBounds(f);
  if (bounds) return bounds.startYmd;
  const s = f.start_date?.trim();
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "\uffff";
}

function planFestivalEndSortKey(f: FestivalDateFields): string {
  const bounds = festivalEffectiveCalendarBounds(f);
  if (bounds) return bounds.endYmd;
  const e = f.end_date?.trim();
  return e && /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : "0000-00-00";
}

function mapPlanFestivalRow(row: {
  id: unknown;
  slug: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  occurrence_dates: unknown;
  start_time: string | null;
  end_time: string | null;
  hero_image: string | null;
  image_url: string | null;
  festival_media?: Array<{
    url: string;
    type?: string | null;
    sort_order?: number | null;
    is_hero?: boolean | null;
  }> | null;
  cities: { name_bg?: string | null; is_village?: boolean | null } | null | undefined | Array<{
    name_bg?: string | null;
    is_village?: boolean | null;
  }>;
}) {
  const rawJoin = row.cities as { name_bg?: string | null; is_village?: boolean | null } | null | undefined;
  const joined = Array.isArray(rawJoin) ? rawJoin[0] : rawJoin;
  const rawMedia = row.festival_media;
  const festival_media = Array.isArray(rawMedia) ? rawMedia : null;
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    city: joined?.name_bg?.trim()
      ? festivalSettlementDisplayText(joined.name_bg, joined.is_village ?? false)
      : null,
    start_date: row.start_date,
    end_date: row.end_date,
    occurrence_dates: row.occurrence_dates ?? null,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    hero_image: row.hero_image ?? null,
    image_url: row.image_url ?? null,
    festival_media,
  };
}

export default async function PlanPage() {
  noStore();
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className={cn(pub.page, "min-h-screen bg-[#f6f4ef] px-4 py-10")}>
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
          <h1 className="text-4xl font-black tracking-tight">Моят план</h1>
          <p className="mt-3 text-sm text-black/75">Влез, за да управляваш избраните събития и напомняния.</p>
          <Link
            href="/login"
            className="mt-4 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.15em] text-white transition-all duration-200 hover:bg-black/90"
          >
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
    occurrence_dates: unknown;
    start_time: string | null;
    end_time: string | null;
    hero_image: string | null;
    image_url: string | null;
    festival_media: Array<{
      url: string;
      type?: string | null;
      sort_order?: number | null;
      is_hero?: boolean | null;
    }> | null;
  }> = [];
  let pastFestivals: typeof festivals = [];

  if (festivalIds.length) {
    const { data: festivalRows } = await supabase
      .from("festivals")
      .select(
        "id,slug,title,start_date,end_date,occurrence_dates,start_time,end_time,hero_image,image_url,festival_media(url,type,sort_order,is_hero),cities:cities!left(name_bg,is_village)"
      )
      .in("id", festivalIds);

    const rows = festivalRows ?? [];
    const upcomingRows = rows.filter((row) => getFestivalTemporalState(row as FestivalDateFields) !== "past");
    const pastRows = rows.filter((row) => getFestivalTemporalState(row as FestivalDateFields) === "past");

    upcomingRows.sort((a, b) =>
      planFestivalSortKey(a as FestivalDateFields).localeCompare(planFestivalSortKey(b as FestivalDateFields))
    );
    pastRows.sort((a, b) =>
      planFestivalEndSortKey(b as FestivalDateFields).localeCompare(planFestivalEndSortKey(a as FestivalDateFields))
    );

    festivals = upcomingRows.map(mapPlanFestivalRow);
    pastFestivals = pastRows.map(mapPlanFestivalRow);
  }

  const activeReminderCount = Object.values(planState.reminders).filter((reminder) => reminder !== "none").length;

  const nextUpcomingFestival = festivals[0] ?? null;

  return (
    <div className={cn(pub.page, "min-h-screen bg-[#f6f4ef] px-4 py-8 md:px-6 md:py-10")}>
      <div className="mx-auto w-full max-w-[1100px]">
        <PlanPageClient
          entries={entries}
          festivals={festivals}
          pastFestivals={pastFestivals}
          summary={{
            savedFestivalCount: festivalIds.length,
            activeReminderCount,
            nextUpcomingFestival: nextUpcomingFestival
              ? {
                  id: nextUpcomingFestival.id,
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
