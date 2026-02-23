import { format, parseISO } from "date-fns";
import Navbar from "@/components/ui/Navbar";
import Badge from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getFestivals } from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata() {
  return {
    title: "Festival map",
    description: "Explore festivals on the map and search by city, date, and category.",
    alternates: {
      canonical: `${getBaseUrl()}/map`,
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

export default async function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  const data = await getFestivals(filters, 1, 30);

  return (
    <div className="bg-white text-ink">
      <Navbar />

      <Section>
        <Container>
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Map</h1>
              <p className="text-sm text-neutral-600 md:text-base">
                Explore festivals by city with a clean, minimal map experience.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-4">
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
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Map coming soon</CardTitle>
                  <CardDescription>We are preparing a lightweight map experience.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-600">
                    Map placeholder
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
