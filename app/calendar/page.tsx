import { eachDayOfInterval, format, isValid, parseISO, startOfMonth } from "date-fns";
import CalendarControls from "@/components/calendar/CalendarControls";
import CalendarViewClient from "@/components/calendar/CalendarViewClient";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { getCalendarMonth } from "@/lib/queries";
import { calendarMeta, getBaseUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";

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
  const [calendarData, categoryOptions] = await Promise.all([
    getCalendarMonth(month, filters),
    listPublicFestivalCategorySlugs(),
  ]);

  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthDays = eachDayOfInterval({ start: monthStart, end: calendarData.monthEnd });
  const dayKeys = monthDays.map((day) => format(day, "yyyy-MM-dd"));
  const dayCounts = Object.fromEntries(dayKeys.map((day) => [day, calendarData.days[day]?.length ?? 0]));
  const initialSelectedDay = buildInitialSelectedDay(dayKeys, calendarData.days);

  return (
    <div className={pub.pageOverflow}>
      <Section className={pub.sectionLoose}>
        <Container>
          <div className={pub.stackLg}>
            <div className={pub.panelHero}>
              <div className="max-w-3xl">
                <p className={pub.eyebrowMuted}>Festivo Planner</p>
                <h1 className={cn(pub.pageTitle, "mt-2")}>Календар</h1>
                <p className={cn(pub.body, "mt-3")}>Виж фестивалите по дати и планирай.</p>
              </div>

              <div className="mt-6">
                <CalendarControls month={month} initialFilters={filters} categoryOptions={categoryOptions} />
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
