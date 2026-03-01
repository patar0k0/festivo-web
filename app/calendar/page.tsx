import { eachDayOfInterval, format, isValid, parseISO, startOfMonth } from "date-fns";
import CalendarControls from "@/components/calendar/CalendarControls";
import CalendarViewClient from "@/components/calendar/CalendarViewClient";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getCalendarMonth } from "@/lib/queries";
import { calendarMeta, getBaseUrl } from "@/lib/seo";
import "../landing.css";

export const revalidate = 3600;

const MONTH_REGEX = /^\d{4}-\d{2}$/;

function resolveMonth(searchParams: Record<string, string | string[] | undefined>) {
  const monthParam = typeof searchParams.month === "string" ? searchParams.month : undefined;
  if (monthParam && MONTH_REGEX.test(monthParam) && isValid(parseISO(`${monthParam}-01`))) {
    return monthParam;
  }

  return format(new Date(), "yyyy-MM");
}

function buildInitialSelectedDay(days: string[], eventsByDay: Record<string, { slug: string }[]>) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (days.includes(today)) {
    return today;
  }

  const firstDayWithEvents = days.find((day) => (eventsByDay[day]?.length ?? 0) > 0);
  return firstDayWithEvents ?? days[0] ?? today;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const month = resolveMonth(searchParams);
  const meta = calendarMeta(month);

  return {
    ...meta,
    title: "Календар на фестивалите | Festivo",
    description: "Виж фестивалите по дати и планирай.",
    alternates: {
      canonical: `${getBaseUrl()}/calendar`,
    },
  };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const month = resolveMonth(searchParams);
  const filters = withDefaultFilters(parseFilters(searchParams));
  const calendarData = await getCalendarMonth(month, filters);

  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthDays = eachDayOfInterval({ start: monthStart, end: calendarData.monthEnd });
  const dayKeys = monthDays.map((day) => format(day, "yyyy-MM-dd"));
  const dayCounts = Object.fromEntries(dayKeys.map((day) => [day, calendarData.days[day]?.length ?? 0]));
  const initialSelectedDay = buildInitialSelectedDay(dayKeys, calendarData.days);

  return (
    <div className="landing-bg overflow-x-hidden text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent pb-8 pt-8 md:pb-10 md:pt-10">
        <Container>
          <div className="space-y-7 lg:space-y-8">
            <div className="rounded-[28px] border border-black/[0.08] bg-white/75 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Festivo Planner</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Календар</h1>
                <p className="mt-3 text-sm text-black/65 md:text-[15px]">Виж фестивалите по дати и планирай.</p>
              </div>

              <div className="mt-6">
                <CalendarControls month={month} initialFilters={filters} />
              </div>
            </div>

            <CalendarViewClient
              month={month}
              dayCounts={dayCounts}
              festivalsByDay={calendarData.days}
              initialSelectedDay={initialSelectedDay}
            />
          </div>
        </Container>
      </Section>
    </div>
  );
}
