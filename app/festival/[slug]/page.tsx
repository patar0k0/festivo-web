import Image from "next/image";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import DetailsSidebar from "@/components/ui/DetailsSidebar";
import Section from "@/components/ui/Section";
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
  const mapQuery = [data.festival.address, data.festival.city].filter(Boolean).join(", ");
  const mapHref = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : null;

  return (
    <div className="bg-white text-neutral-900">
      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Event</p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{data.festival.title}</h1>
                <p className="text-sm text-neutral-600">
                  {data.festival.city ? data.festival.city : "Град: —"} • {dateText}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {data.festival.is_free ? <Badge variant="primary">Free</Badge> : null}
                  {data.festival.category ? <Badge variant="neutral">{data.festival.category}</Badge> : null}
                </div>
              </div>

              {heroImage ? (
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-neutral-200">
                  <Image src={heroImage} alt={data.festival.title} fill className="object-cover" />
                </div>
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 text-sm text-neutral-500">
                  No image
                </div>
              )}

              <div className="space-y-4">
                <h2 className="text-xl font-semibold">About the event</h2>
                <p className="text-sm leading-7 text-neutral-600">
                  {data.festival.description ?? "No description yet."}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Location / Venue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-600">{venueText}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Getting there</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-600">Details coming soon.</p>
                  </CardContent>
                </Card>
              </div>

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
                  <h2 className="text-xl font-semibold">More events in {data.festival.city}</h2>
                  <p className="text-sm text-neutral-600">
                    Discover more festivals happening in the same city.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <DetailsSidebar dateText={dateText} venueText={venueText} mapHref={mapHref} />
            </div>
          </div>
        </Container>
      </Section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
