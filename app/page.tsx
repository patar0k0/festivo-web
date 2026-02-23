import Image from "next/image";
import { format, parseISO } from "date-fns";
import Navbar from "@/components/ui/Navbar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";
import Select from "@/components/ui/Select";
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

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

export default async function HomePage() {
  const featured = await getFestivals({ free: true, sort: "soonest" }, 1, 6);

  return (
    <div className="bg-white text-ink">
      <Navbar />

      <Section>
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">Festivo</p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Discover festivals with a calm, premium feel.
              </h1>
              <p className="max-w-xl text-base text-neutral-600">
                Browse curated events, check dates, and plan weekends with a clean, focused experience.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" href="/festivals">
                  Browse festivals
                </Button>
                <Button variant="secondary" size="lg" href="/map">
                  Open map
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Search festivals</CardTitle>
                <CardDescription>Find by keyword, city, or date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input placeholder="Keyword" />
                  <Input placeholder="City" />
                  <Select defaultValue="">
                    <option value="">Any time</option>
                    <option value="today">Today</option>
                    <option value="weekend">Weekend</option>
                    <option value="month">This month</option>
                  </Select>
                </div>
                <Button variant="primary" size="md">
                  Search
                </Button>
              </CardContent>
            </Card>
          </div>
        </Container>
      </Section>

      <Section background="muted">
        <Container>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">ПРЕПОРЪЧАНИ</p>
              <h2 className="text-2xl font-semibold tracking-tight">Безплатни фестивали скоро</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.data.map((festival) => (
                <Card key={festival.id}>
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
                  {festival.image_url ? (
                    <div className="relative aspect-[16/10] overflow-hidden rounded-b-2xl">
                      <Image src={festival.image_url} alt={festival.title} fill className="object-cover" />
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
