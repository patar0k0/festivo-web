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
import Divider from "@/components/ui/Divider";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
  const featured = await getFestivals({ free: true, sort: "soonest" }, 1, 6);
  const hasFeatured = featured.data.length > 0;

  return (
    <div className="space-y-12">
      <section className="border-b border-ink/10 bg-sand/40 py-14">
        <Container>
          <Stack size="lg">
            <Stack size="sm">
              <Heading as="h1" size="h1" className="text-4xl sm:text-5xl">
                Безплатни фестивали в България
              </Heading>
              <Text variant="muted">Открий какво има по град, дата и на карта.</Text>
            </Stack>

            <div className="flex flex-wrap items-center gap-3">
              <Button href="/festivals">Разгледай фестивали</Button>
              <Button href="/map" variant="secondary">
                Виж на карта
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="free">Безплатни</Badge>
              <Badge variant="category">Календар</Badge>
              <Badge variant="category">Карта</Badge>
              <Badge variant="category">Подбрани</Badge>
            </div>
          </Stack>
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
                      {festival.image_url ? (
                        <CardHeader className="aspect-[16/10] border-b border-ink/10">
                          <Image
                            src={festival.image_url}
                            alt={festival.title}
                            fill
                            className="rounded-t-xl object-cover"
                          />
                        </CardHeader>
                      ) : null}
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
                        {festival.description ? (
                          <p
                            className="text-sm text-muted"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {festival.description}
                          </p>
                        ) : null}
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

      <Divider />

      <Section>
        <Container>
          <Stack size="lg">
            <Heading as="h2" size="h2">
              Разгледай
            </Heading>
            <div className="grid gap-6 md:grid-cols-3">
              <Link href="/festivals">
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-soft">
                  <CardBody className="space-y-2">
                    <Heading as="h3" size="h3" className="text-lg">
                      Фийд
                    </Heading>
                    <Text variant="muted" size="sm">
                      Подбрани фестивали и бързи филтри.
                    </Text>
                  </CardBody>
                </Card>
              </Link>
              <Link href="/calendar">
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-soft">
                  <CardBody className="space-y-2">
                    <Heading as="h3" size="h3" className="text-lg">
                      Календар
                    </Heading>
                    <Text variant="muted" size="sm">
                      План за месеца с фестивали по дати.
                    </Text>
                  </CardBody>
                </Card>
              </Link>
              <Link href="/map">
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-soft">
                  <CardBody className="space-y-2">
                    <Heading as="h3" size="h3" className="text-lg">
                      Карта
                    </Heading>
                    <Text variant="muted" size="sm">
                      Намери фестивали около теб на карта.
                    </Text>
                  </CardBody>
                </Card>
              </Link>
            </div>
          </Stack>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Text variant="muted" size="sm">
              Планирането и напомнянията са в приложението.
            </Text>
            <Button href="#" variant="ghost">
              Open in app
            </Button>
          </div>
        </Container>
      </Section>
    </div>
  );
}
