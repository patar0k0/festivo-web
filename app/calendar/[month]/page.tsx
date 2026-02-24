import { notFound } from "next/navigation";
import { addMonths, eachDayOfInterval, format, isValid, parseISO, startOfMonth } from "date-fns";
import FestivalList from "@/components/FestivalList";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Stack from "@/components/ui/Stack";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";
import ApplePill from "@/components/apple/ApplePill";
import AppleDivider from "@/components/apple/AppleDivider";
import { AppleCard, AppleCardBody } from "@/components/apple/AppleCard";
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
  if (!/^\d{4}-\d{2}$/.test(month) || !isValid(parseISO(`${month}-01`))) {
    return notFound();
  }
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
  if (filters.free !== undefined) query.set("free", filters.free ? "1" : "0");
  if (filters.sort) query.set("sort", filters.sort);
  const queryString = query.toString();

  return (
    <Container>
      <Section>
        <Stack size="lg">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Text variant="muted" size="sm" className="text-xs uppercase tracking-[0.2em]">
                Festival calendar
              </Text>
              <Heading as="h1" size="h1">
                {format(monthStart, "MMMM yyyy")}
              </Heading>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ApplePill href={`/calendar/${prev}${queryString ? `?${queryString}` : ""}`}>Prev</ApplePill>
            <ApplePill href={`/calendar/${next}${queryString ? `?${queryString}` : ""}`}>Next</ApplePill>
          </div>

          <AppleDivider />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const count = data.days[key]?.length ?? 0;
              return (
                <a key={key} href={`#day-${key}`}>
                  <AppleCard>
                    <AppleCardBody className="space-y-1 text-sm">
                      <p className="text-xs uppercase tracking-widest text-muted">{format(day, "EEE")}</p>
                      <p className="text-lg font-semibold text-ink">{format(day, "d")}</p>
                      <p className="text-xs text-muted">{count} festivals</p>
                    </AppleCardBody>
                  </AppleCard>
                </a>
              );
            })}
          </div>

          <div className="space-y-10">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const festivals = data.days[key] ?? [];
              return (
                <div key={key} id={`day-${key}`} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Heading as="h2" size="h2" className="text-xl">
                      {format(day, "d MMMM")}
                    </Heading>
                    <span className="text-xs uppercase tracking-widest text-muted">
                      {festivals.length} events
                    </span>
                  </div>
                  {festivals.length ? (
                    <FestivalList festivals={festivals} />
                  ) : (
                    <Text variant="muted" size="sm">
                      No festivals listed.
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        </Stack>
      </Section>
    </Container>
  );
}
