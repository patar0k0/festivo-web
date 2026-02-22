import FestivalList from "@/components/FestivalList";
import ViewToggle from "@/components/ViewToggle";
import MapViewClient from "@/components/MapViewClient";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Stack from "@/components/ui/Stack";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";
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

export default async function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  const data = await getFestivals(filters, 1, 50);

  return (
    <Container>
      <Section>
        <Stack size="lg">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Heading as="h1" size="h1">
                Map
              </Heading>
              <Text variant="muted" size="sm">
                Разгледай фестивалите по карта и град.
              </Text>
            </div>
            <ViewToggle active="/map" filters={filters} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <FestivalList festivals={data.data} />
            </div>
            <div className="rounded-xl border border-ink/10 bg-white shadow-soft">
              <MapViewClient festivals={data.data} />
            </div>
          </div>
        </Stack>
      </Section>
    </Container>
  );
}
