import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import Badge from "@/components/ui/Badge";
import Container from "@/components/ui/Container";
import DetailsSidebar from "@/components/ui/DetailsSidebar";
import Section from "@/components/ui/Section";
import FestivalHighlights from "@/components/FestivalHighlights";
import FestivalProgram from "@/components/FestivalProgram";
import FestivalGoodToKnow from "@/components/FestivalGoodToKnow";
import FestivalLocation from "@/components/FestivalLocation";
import EventCard from "@/components/ui/EventCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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

function slugifyCity(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
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
  const dateTextRaw = formatDateRange(data.festival.start_date, data.festival.end_date);
  const dateText = dateTextRaw === "Dates TBA" ? "Дата: предстои" : dateTextRaw;
  const venueText = [data.festival.city, data.festival.address].filter(Boolean).join(", ") || "Venue: —";
  const mapQuery = data.festival.lat && data.festival.lng
    ? `${data.festival.lat},${data.festival.lng}`
    : [data.festival.address, data.festival.city].filter(Boolean).join(", ");
  const mapHref = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : null;
  const deepLink = `festivo://festival/${data.festival.slug}`;
  const icsHref = `/festival/${data.festival.slug}/ics`;
  const citySlug = data.festival.city ? slugifyCity(data.festival.city) : null;
  const calendarMonth = data.festival.start_date ? format(parseISO(data.festival.start_date), "yyyy-MM") : null;

  return (
    <div className="bg-white text-neutral-900">
      <Section className="py-10">
        <Container>
          <div className="space-y-8">
            <div className="relative overflow-hidden rounded-2xl border border-neutral-200">
              {heroImage ? (
                <div className="relative h-[320px]">
                  <Image src={heroImage} alt={data.festival.title} fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/35" />
                </div>
              ) : (
                <div className="flex h-[240px] flex-col items-center justify-center gap-2 bg-neutral-100 text-sm text-neutral-500">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-13C4.67 20 4 19.33 4 18.5v-13Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <path d="M8 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.2" />
                    <path d="m4 17 4.5-4.5 3.5 3.5 4.5-4.5L20 15.5" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  <span>No image</span>
                </div>
              )}
              <div className="absolute bottom-6 left-6 space-y-2 text-white">
                <p className="text-sm text-white/80">
                  {data.festival.city ? (
                    <Link href={`/city/${citySlug}`} className="underline">
                      {data.festival.city}
                    </Link>
                  ) : (
                    "Град: —"
                  )} {" "}
                  • {dateText}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{data.festival.title}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  {data.festival.is_free ? <Badge variant="primary">Free</Badge> : null}
                  {data.festival.category ? <Badge variant="neutral">{data.festival.category}</Badge> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Описание</h2>
                  <p
                    className="text-sm leading-7 text-neutral-600"
                    style={{ display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    {data.festival.description ?? "No description yet."}
                  </p>
                  {data.festival.description ? (
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Read more</summary>
                      <p className="mt-3 text-sm text-neutral-600">{data.festival.description}</p>
                    </details>
                  ) : null}
                </div>

                <FestivalHighlights festival={data.festival} />
                <FestivalProgram days={data.days} items={data.scheduleItems} />
                <FestivalLocation festival={data.festival} />
                <FestivalGoodToKnow festival={data.festival} />

                {(data.festival.website_url || data.festival.ticket_url) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Links</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {data.festival.website_url ? (
                        <a href={data.festival.website_url} className="text-sm font-medium text-neutral-900">
                          Website
                        </a>
                      ) : null}
                      {data.festival.ticket_url ? (
                        <a href={data.festival.ticket_url} className="text-sm font-medium text-neutral-900">
                          Tickets
                        </a>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                {moreInCity?.data?.length ? (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">More festivals in {data.festival.city}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {citySlug ? (
                        <Link href={`/city/${citySlug}`} className="font-semibold text-neutral-900">
                          City page
                        </Link>
                      ) : null}
                      {calendarMonth ? (
                        <Link href={`/calendar/${calendarMonth}`} className="font-semibold text-neutral-900">
                          Calendar month
                        </Link>
                      ) : null}
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      {moreInCity.data
                        .filter((festival) => festival.slug !== data.festival.slug)
                        .slice(0, 4)
                        .map((festival) => (
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
                ) : null}
              </div>

              <div className="lg:sticky lg:top-24 lg:self-start">
                <DetailsSidebar dateText={dateText} venueText={venueText} mapHref={mapHref} deepLink={deepLink} icsHref={icsHref} />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
