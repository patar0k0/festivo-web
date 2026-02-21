import Link from "next/link";
import { addMonths, eachDayOfInterval, format, parseISO, startOfMonth } from "date-fns";
import ViewToggle from "@/components/ViewToggle";
import FestivalList from "@/components/FestivalList";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getCalendarMonth } from "@/lib/queries";
import { calendarMeta, getBaseUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { month: string } }) {
  const meta = calendarMeta(params.month);
  return {
    ...meta,
    alternates: {
      canonical: `${getBaseUrl()}/calendar/${params.month}`,
    },
  };
}

export default async function CalendarMonthPage({
  params,
  searchParams,
}: {
  params: { month: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  const { month } = params;
  const data = await getCalendarMonth(month, filters);

  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const days = eachDayOfInterval({ start: monthStart, end: data.monthEnd });
  const prev = format(addMonths(monthStart, -1), "yyyy-MM");
  const next = format(addMonths(monthStart, 1), "yyyy-MM");
  const query = new URLSearchParams();
  if (filters.city?.length) query.set("city", filters.city.join(","));
  if (filters.region?.length) query.set("region", filters.region.join(","));
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.cat?.length) query.set("cat", filters.cat.join(","));
  if (filters.tags?.length) query.set("tags", filters.tags.join(","));
  if (filters.free !== undefined) query.set("free", filters.free ? "1" : "0");
  if (filters.sort) query.set("sort", filters.sort);
  const queryString = query.toString();

  return (
    <div className="container-page space-y-8 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Festival calendar</p>
          <h1 className="text-3xl font-semibold">{format(monthStart, "MMMM yyyy")}</h1>
        </div>
        <ViewToggle active="/calendar" filters={filters} />
      </div>

      <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest">
        <Link
          href={`/calendar/${prev}${queryString ? `?${queryString}` : ""}`}
          className="rounded-full border border-ink/10 bg-white/80 px-4 py-2"
        >
          Prev
        </Link>
        <Link
          href={`/calendar/${next}${queryString ? `?${queryString}` : ""}`}
          className="rounded-full border border-ink/10 bg-white/80 px-4 py-2"
        >
          Next
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const count = data.days[key]?.length ?? 0;
          return (
            <a
              key={key}
              href={`#day-${key}`}
              className="rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm"
            >
              <p className="text-xs uppercase tracking-widest text-muted">{format(day, "EEE")}</p>
              <p className="text-lg font-semibold">{format(day, "d")}</p>
              <p className="text-xs text-muted">{count} festivals</p>
            </a>
          );
        })}
      </div>

      <div className="space-y-8">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const festivals = data.days[key] ?? [];
          return (
            <div key={key} id={`day-${key}`} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{format(day, "d MMMM")}</h2>
                <span className="text-xs uppercase tracking-widest text-muted">
                  {festivals.length} events
                </span>
              </div>
              {festivals.length ? (
                <FestivalList festivals={festivals} />
              ) : (
                <p className="text-sm text-muted">No festivals listed.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
