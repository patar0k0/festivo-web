import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import HeroSearch from "@/components/ui/HeroSearch";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { getFestivals } from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";

export const revalidate = 21600;

export async function generateMetadata() {
  return {
    title: "Festivo — Discover festivals in Bulgaria",
    description: "Browse verified festivals, find dates, and plan weekends across Bulgaria.",
    alternates: {
      canonical: `${getBaseUrl()}/`,
    },
  };
}

export default async function HomePage() {
  const featured = await getFestivals({ free: true, sort: "soonest" }, 1, 6);

  return (
    <div className="bg-white text-neutral-900">
      <Section>
        <Container>
          <HeroSearch />
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">EVENTS</p>
                <h2 className="text-2xl font-semibold tracking-tight">Предстоящи безплатни фестивали</h2>
              </div>
              <Button variant="secondary" size="sm" href="/festivals">
                Browse events
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.data.map((festival) => (
                <Link key={festival.slug} href={`/festival/${festival.slug}`} className="group">
                  <EventCard
                    title={festival.title}
                    city={festival.city}
                    category={festival.category}
                    imageUrl={festival.image_url}
                    startDate={festival.start_date}
                    endDate={festival.end_date}
                    isFree={festival.is_free}
                  />
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
