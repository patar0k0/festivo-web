import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Stack from "@/components/ui/Stack";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getCities, getFestivals } from "@/lib/queries";
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

function formatBadgeDate(start?: string | null) {
  if (!start) return "TBA";
  const date = parseISO(start);
  return format(date, "MMM d");
}

function SkeletonGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="h-[260px] rounded-xl border border-ink/10 bg-white shadow-soft"
        />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const [featured, cities] = await Promise.all([
    getFestivals({ free: true, sort: "soonest" }, 1, 6),
    getCities(),
  ]);
  const hasFeatured = featured.data.length > 0;

  return (
    <div className="space-y-14">
      <section className="relative min-h-[420px] overflow-hidden sm:min-h-[520px]">
        <div className="absolute inset-0 bg-[url('/hero.svg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/60" />

        <Container className="relative">
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-white sm:min-h-[520px]">
            <Stack size="sm" className="max-w-2xl">
              <Heading as="h1" size="h1" className="text-4xl text-white sm:text-5xl">
                Festivo
              </Heading>
              <Text variant="muted" className="text-white/80">
                Открий безплатни фестивали в България
              </Text>
            </Stack>
          </div>
        </Container>

        <Container className="relative -mt-16 pb-10">
          <Card className="bg-white">
            <CardBody className="space-y-4">
              <form action="/festivals" className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-muted">Какво</label>
                  <input
                    name="q"
                    type="text"
                    placeholder="Търси фестивали…"
                    className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-muted">Къде</label>
                  <select name="city" className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm">
                    <option value="">Навсякъде</option>
                    {cities.length
                      ? cities.slice(0, 12).map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))
                      : ["Sofia", "Plovdiv", "Varna"].map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-muted">Кога</label>
                  <select name="when" className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm">
                    <option value="">Any time</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit">Търси</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </Container>
      </section>

      <Section>
        <Container>
          <Stack size="lg">
            <Heading as="h2" size="h2">
              Подбрани
            </Heading>

            {hasFeatured ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featured.data.map((festival) => (
                  <Link key={festival.id} href={`/festival/${festival.slug}`} className="group">
                    <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-soft">
                      <CardHeader className="relative aspect-[16/10] border-b border-ink/10">
                        {festival.image_url ? (
                          <Image
                            src={festival.image_url}
                            alt={festival.title}
                            fill
                            className="rounded-t-xl object-cover"
                          />
                        ) : null}
                        <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-ink">
                          {formatBadgeDate(festival.start_date)}
                        </div>
                      </CardHeader>
                      <CardBody className="space-y-3">
                        <Heading as="h3" size="h3" className="text-lg">
                          {festival.title}
                        </Heading>
                        <Text variant="muted" size="sm">
                          {festival.city ?? "Bulgaria"} • {formatDateRange(festival.start_date, festival.end_date)}
                        </Text>
                        <div className="flex flex-wrap gap-2">
                          {festival.is_free ? <Badge variant="free">Безплатно</Badge> : null}
                          {festival.category ? <Badge variant="category">{festival.category}</Badge> : null}
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <SkeletonGrid />
            )}
          </Stack>
        </Container>
      </Section>
    </div>
  );
}
