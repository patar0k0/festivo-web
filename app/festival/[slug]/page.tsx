import Image from "next/image";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import FestivalProgram from "@/components/FestivalProgram";
import FestivalGoodToKnow from "@/components/FestivalGoodToKnow";
import FestivalLocation from "@/components/FestivalLocation";
import FestivalHighlights from "@/components/FestivalHighlights";
import FestivalGrid from "@/components/FestivalGrid";
import Container from "@/components/ui/Container";
import Stack from "@/components/ui/Stack";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";
import AppleButton from "@/components/apple/AppleButton";
import ApplePill from "@/components/apple/ApplePill";
import AppleDivider from "@/components/apple/AppleDivider";
import { AppleCard, AppleCardBody, AppleCardHeader } from "@/components/apple/AppleCard";
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

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const festival = await getFestivalBySlug(params.slug);
  if (!festival) return {};
  const meta = festivalMeta(festival);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${getBaseUrl()}/festival/${params.slug}`,
    },
  };
}

export default async function FestivalDetailPage({ params }: { params: { slug: string } }) {
  const data = await getFestivalDetail(params.slug);
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

  return (
    <Container className="py-10">
      <Stack size="xl">
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <Stack size="lg">
            <Stack size="sm">
              <Heading as="h1" size="h1">
                {data.festival.title}
              </Heading>
              <Text variant="muted" size="sm">
                {data.festival.city ?? "Bulgaria"} · {formatDateRange(data.festival.start_date, data.festival.end_date)}
              </Text>
              <div className="flex flex-wrap gap-2">
                {data.festival.is_free ? <ApplePill active>Free</ApplePill> : null}
                {data.festival.category ? <ApplePill>{data.festival.category}</ApplePill> : null}
              </div>
            </Stack>

            {heroImage ? (
              <AppleCard>
                <AppleCardHeader className="aspect-[16/10] border-b apple-border">
                  <Image src={heroImage} alt={data.festival.title} fill className="object-cover" />
                </AppleCardHeader>
              </AppleCard>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <AppleButton variant="primary">Open in app</AppleButton>
              <AppleButton>Save to plan</AppleButton>
            </div>

            {data.festival.description ? (
              <section className="space-y-4">
                <Heading as="h2" size="h2">
                  About
                </Heading>
                <Text
                  variant="muted"
                  className="leading-7"
                  style={{ display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {data.festival.description}
                </Text>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Read more</summary>
                  <Text variant="muted" className="mt-4 leading-7">
                    {data.festival.description}
                  </Text>
                </details>
              </section>
            ) : null}

            {data.festival.ticket_url || data.festival.website_url ? (
              <section className="space-y-4">
                <Heading as="h2" size="h2">
                  Линкове
                </Heading>
                <div className="flex flex-col gap-2 text-sm">
                  {data.festival.website_url ? (
                    <a
                      href={data.festival.website_url}
                      className="font-semibold text-ink"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Официален сайт
                    </a>
                  ) : null}
                  {data.festival.ticket_url ? (
                    <a
                      href={data.festival.ticket_url}
                      className="font-semibold text-ink"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Билети {data.festival.price_range ? `· ${data.festival.price_range}` : ""}
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}

            <AppleDivider />
            <FestivalHighlights festival={data.festival} />
            <FestivalProgram days={data.days} items={data.scheduleItems} />
            <FestivalLocation festival={data.festival} />
            <FestivalGoodToKnow festival={data.festival} />
          </Stack>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <AppleCard>
              <AppleCardBody className="space-y-4">
                <Heading as="h3" size="h3" className="text-lg">
                  Quick info
                </Heading>
                <div className="space-y-3 text-sm text-muted">
                  <div>
                    <span className="block text-xs uppercase tracking-widest text-ink/60">City</span>
                    <span className="font-semibold text-ink">{data.festival.city ?? "Bulgaria"}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-widest text-ink/60">Dates</span>
                    <span className="font-semibold text-ink">
                      {formatDateRange(data.festival.start_date, data.festival.end_date)}
                    </span>
                  </div>
                  {data.festival.address ? (
                    <div>
                      <span className="block text-xs uppercase tracking-widest text-ink/60">Address</span>
                      <span className="font-semibold text-ink">{data.festival.address}</span>
                    </div>
                  ) : null}
                  {data.festival.ticket_url ? (
                    <div>
                      <span className="block text-xs uppercase tracking-widest text-ink/60">Tickets</span>
                      <a
                        href={data.festival.ticket_url}
                        className="font-semibold text-ink"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {data.festival.price_range ?? "Ticket info"}
                      </a>
                    </div>
                  ) : null}
                  {data.festival.website_url ? (
                    <div>
                      <span className="block text-xs uppercase tracking-widest text-ink/60">Website</span>
                      <a
                        href={data.festival.website_url}
                        className="font-semibold text-ink"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Visit site
                      </a>
                    </div>
                  ) : null}
                  <div>
                    <span className="block text-xs uppercase tracking-widest text-ink/60">Shareable link</span>
                    <span className="font-semibold text-ink">{`${getBaseUrl()}/festival/${data.festival.slug}`}</span>
                  </div>
                </div>
              </AppleCardBody>
            </AppleCard>
          </aside>
        </section>

        {moreInCity?.data?.length ? (
          <section className="space-y-6">
            <Heading as="h2" size="h2">
              More festivals in {data.festival.city}
            </Heading>
            <FestivalGrid festivals={moreInCity.data.filter((festival) => festival.slug !== data.festival.slug)} />
          </section>
        ) : null}

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Stack>
    </Container>
  );
}
