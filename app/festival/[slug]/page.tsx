import Image from "next/image";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import FestivalProgram from "@/components/FestivalProgram";
import FestivalGrid from "@/components/FestivalGrid";
import Container from "@/app/_components/ui/Container";
import Badge from "@/app/_components/ui/Badge";
import Button from "@/app/_components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/_components/ui/Card";
import Select from "@/app/_components/ui/Select";
import { getCityFestivals, getFestivalBySlug, getFestivalDetail } from "@/lib/queries";
import { buildFestivalJsonLd, festivalMeta, getBaseUrl } from "@/lib/seo";

export const revalidate = 21600;

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const festival = await getFestivalBySlug(slug);
  if (!festival) return {};
  const meta = festivalMeta(festival);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${getBaseUrl()}/festival/${slug}`,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // use slug below
  const data = await getFestivalDetail(slug);
  if (!data) return notFound();

  const jsonLd = buildFestivalJsonLd(data.festival);
  const moreInCity = data.festival.city
    ? await getCityFestivals(
        data.festival.city,
        { city: [data.festival.city], free: data.festival.is_free ?? true },
        1,
        6
      )
    : null;

  const heroImage = data.festival.image_url ?? null;
  const mapQuery = encodeURIComponent([data.festival.address, data.festival.city].filter(Boolean).join(", "));

  return (
    <Container className="py-10">
      <div className="space-y-10">
        <section className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{data.festival.title}</h1>
              <p className="text-sm text-neutral-600">
                {data.festival.city ?? "Bulgaria"} • {formatDateRange(data.festival.start_date, data.festival.end_date)}
              </p>
              <div className="flex flex-wrap gap-2">
                {data.festival.is_free ? <Badge>Безплатно</Badge> : null}
                {data.festival.category ? <Badge variant="neutral">{data.festival.category}</Badge> : null}
              </div>
            </div>

            {heroImage ? (
              <Card>
                <CardHeader className="relative aspect-[16/10] border-b border-black/10 p-0">
                  <Image src={heroImage} alt={data.festival.title} fill className="object-cover" />
                </CardHeader>
              </Card>
            ) : null}

            {data.festival.description ? (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold">Описание</h2>
                <p
                  className="max-w-[70ch] text-sm text-neutral-600 leading-7"
                  style={{ display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {data.festival.description}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Read more</summary>
                  <p className="mt-4 text-sm text-neutral-600 leading-7">{data.festival.description}</p>
                </details>
              </section>
            ) : null}

            <FestivalProgram days={data.days} items={data.scheduleItems} />

            {data.festival.ticket_url || data.festival.website_url ? (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold">Линкове</h2>
                <div className="flex flex-col gap-2 text-sm">
                  {data.festival.website_url ? (
                    <a
                      href={data.festival.website_url}
                      className="font-semibold text-neutral-900"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Официален сайт
                    </a>
                  ) : null}
                  {data.festival.ticket_url ? (
                    <a
                      href={data.festival.ticket_url}
                      className="font-semibold text-neutral-900"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Билети {data.festival.price_range ? `• ${data.festival.price_range}` : ""}
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader className="border-b border-black/10">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-600">Информация</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <span className="block text-xs uppercase tracking-[0.2em] text-neutral-600">Дата</span>
                  <span className="font-semibold text-neutral-900">
                    {formatDateRange(data.festival.start_date, data.festival.end_date)}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <span className="block text-xs uppercase tracking-[0.2em] text-neutral-600">Град</span>
                  <span className="font-semibold text-neutral-900">{data.festival.city ?? "Bulgaria"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.festival.is_free ? <Badge>Безплатно</Badge> : null}
                  {data.festival.category ? <Badge variant="neutral">{data.festival.category}</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary">Добави в план</Button>
                  <form action="https://www.google.com/maps/search/" method="get" target="_blank" rel="noreferrer">
                    <input type="hidden" name="api" value="1" />
                    <input type="hidden" name="query" value={mapQuery} />
                    <Button variant="secondary" type="submit">
                      Навигация
                    </Button>
                  </form>
                </div>
                <div className="space-y-2">
                  <span className="block text-xs uppercase tracking-[0.2em] text-neutral-600">Напомняне</span>
                  <Select className="w-full">
                    <option value="none">None</option>
                    <option value="24h">24h before</option>
                    <option value="same-day">Same day 09:00</option>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <p className="text-xs text-neutral-600">Съхрани, за да не изпуснеш фестивала.</p>
              </CardFooter>
            </Card>
          </aside>
        </section>

        {moreInCity?.data?.length ? (
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">More festivals in {data.festival.city}</h2>
            <FestivalGrid festivals={moreInCity.data.filter((festival) => festival.slug !== data.festival.slug)} />
          </section>
        ) : null}

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </div>
    </Container>
  );
}
