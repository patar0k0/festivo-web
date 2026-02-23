import { format, parseISO } from "date-fns";
import Navbar from "@/components/ui/Navbar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getFestivals } from "@/lib/queries";
import { getBaseUrl, listMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata() {
  const meta = listMeta();
  return {
    ...meta,
    alternates: {
      canonical: `${getBaseUrl()}/festivals`,
    },
  };
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

export default async function FestivalsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  const page = Number(searchParams.page ?? 1);
  const data = await getFestivals(filters, Number.isNaN(page) ? 1 : page, 12);

  return (
    <div className="bg-white text-ink">
      <Navbar />

      <Section>
        <Container>
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Festivals</h1>
              <p className="max-w-2xl text-sm text-neutral-600 md:text-base">
                Curated events with clean filters by city, date, and category.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                placeholder="City"
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-ink placeholder:text-neutral-500 sm:w-64"
              />
              <Button variant="ghost" size="md">
                Free only
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <Section background="muted">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.data.map((festival) => (
              <Card key={festival.slug}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    {festival.is_free ? <Badge variant="primary">Free</Badge> : null}
                    {festival.category ? <Badge variant="neutral">{festival.category}</Badge> : null}
                  </div>
                  <CardTitle>{festival.title}</CardTitle>
                  <CardDescription>
                    {festival.city ?? "Bulgaria"} • {formatDateRange(festival.start_date, festival.end_date)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    A refined selection focused on dates, place, and the right atmosphere.
                  </p>
                  <Button variant="secondary" size="sm" href={`/festival/${festival.slug}`}>
                    Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
