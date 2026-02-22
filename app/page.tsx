import Link from "next/link";
import Container from "@/components/ui/Container";
import Stack from "@/components/ui/Stack";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Divider from "@/components/ui/Divider";
import { Card, CardBody } from "@/components/ui/Card";
import FestivalGrid from "@/components/FestivalGrid";
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

function SkeletonGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="h-[260px] rounded-2xl border border-ink/10 bg-ink/5"
        />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const featured = await getFestivals({ free: true, sort: "soonest" }, 1, 6);
  const hasFeatured = featured.data.length > 0;

  return (
    <Container className="py-12">
      <Stack size="xl">
        <section className="space-y-8">
          <Stack size="sm">
            <Heading as="h1" size="h1">
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
          </div>
        </section>

        <Divider />

        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <Heading as="h2" size="h2">
              Подбрани
            </Heading>
            <Link href="/festivals" className="text-sm font-semibold text-ink">
              Виж всички
            </Link>
          </div>
          {hasFeatured ? <FestivalGrid festivals={featured.data} /> : <SkeletonGrid />}
        </section>

        <Divider />

        <section className="space-y-6">
          <Heading as="h2" size="h2">
            Навигация
          </Heading>
          <div className="grid gap-6 md:grid-cols-3">
            <Link href="/festivals">
              <Card className="h-full transition hover:-translate-y-1">
                <CardBody className="space-y-3">
                  <Heading as="h3" size="h3" className="text-lg">
                    Feed
                  </Heading>
                  <Text variant="muted" size="sm">
                    Подбрани фестивали с филтри по град и дата.
                  </Text>
                </CardBody>
              </Card>
            </Link>
            <Link href="/calendar">
              <Card className="h-full transition hover:-translate-y-1">
                <CardBody className="space-y-3">
                  <Heading as="h3" size="h3" className="text-lg">
                    Calendar
                  </Heading>
                  <Text variant="muted" size="sm">
                    Разгледай календара и планирай месеца си.
                  </Text>
                </CardBody>
              </Card>
            </Link>
            <Link href="/map">
              <Card className="h-full transition hover:-translate-y-1">
                <CardBody className="space-y-3">
                  <Heading as="h3" size="h3" className="text-lg">
                    Map
                  </Heading>
                  <Text variant="muted" size="sm">
                    Виж фестивалите на карта и открий близки места.
                  </Text>
                </CardBody>
              </Card>
            </Link>
          </div>
        </section>

        <Divider />

        <section className="flex flex-wrap items-center justify-between gap-4">
          <Text variant="muted" size="sm">
            Планирането и напомнянията са в приложението.
          </Text>
          <div className="flex flex-wrap gap-3">
            <Button href="#">Open in app</Button>
            <Button href="#" variant="secondary">
              Save to plan
            </Button>
          </div>
        </section>
      </Stack>
    </Container>
  );
}
