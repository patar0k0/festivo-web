import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Stack from "@/components/ui/Stack";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";
import AppleButton from "@/components/apple/AppleButton";
import ApplePill from "@/components/apple/ApplePill";
import { AppleCard, AppleCardBody, AppleCardHeader } from "@/components/apple/AppleCard";
import AppleInput from "@/components/apple/AppleInput";
import AppleSelect from "@/components/apple/AppleSelect";
import AppleDivider from "@/components/apple/AppleDivider";
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
          className="h-[320px] rounded-[var(--radius)] border apple-border apple-surface apple-shadow2"
        />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const featured = await getFestivals({ free: true, sort: "soonest" }, 1, 6);
  const hasFeatured = featured.data.length > 0;

  return (
    <div className="space-y-14">
      <Section>
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <AppleCard className="h-full">
              <AppleCardBody className="space-y-6">
                <div>
                  <Heading as="h1" size="h1" className="text-4xl sm:text-5xl">
                    Фестивали в България.
                  </Heading>
                  <Text variant="muted" className="mt-3">
                    Чисто. Бързо. Само най-важното: дата, град, жанр, цена и план.
                  </Text>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <AppleInput placeholder="Търси фестивали…" />
                  <AppleButton variant="primary">Търси</AppleButton>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ApplePill active>Безплатни</ApplePill>
                  <ApplePill>Тази седмица</ApplePill>
                  <ApplePill>Джаз</ApplePill>
                  <ApplePill>Храна</ApplePill>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Фестивали</p>
                    <p className="text-xl font-semibold">{featured.total}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Градове</p>
                    <p className="text-xl font-semibold">25+</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Месеци</p>
                    <p className="text-xl font-semibold">12</p>
                  </div>
                </div>
              </AppleCardBody>
            </AppleCard>

            <AppleCard>
              <AppleCardBody className="space-y-4">
                <Heading as="h2" size="h2" className="text-2xl">
                  Бързи входове
                </Heading>
                <div className="space-y-3">
                  {["Sofia", "Plovdiv", "Черноморие"].map((label) => (
                    <Link key={label} href="/festivals" className="block">
                      <div className="flex items-center justify-between rounded-[var(--radius)] border apple-border bg-[var(--surface2)] px-4 py-3 text-sm">
                        <span className="font-semibold">{label}</span>
                        <span className="text-muted">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </AppleCardBody>
            </AppleCard>
          </div>
        </Container>
      </Section>

      <AppleDivider />

      <Section>
        <Container>
          <Stack size="lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <ApplePill active>Подбрани</ApplePill>
                <ApplePill>Днес</ApplePill>
                <ApplePill>Уикенд</ApplePill>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AppleSelect defaultValue="">
                  <option value="">Сортиране</option>
                  <option value="soonest">Най-скоро</option>
                  <option value="curated">Подбрани</option>
                </AppleSelect>
                <AppleButton>Филтри</AppleButton>
              </div>
            </div>

            {hasFeatured ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featured.data.map((festival) => (
                  <AppleCard key={festival.id} className="h-full">
                    <AppleCardHeader className="relative aspect-[16/10] border-b apple-border">
                      {festival.image_url ? (
                        <Image
                          src={festival.image_url}
                          alt={festival.title}
                          fill
                          className="rounded-t-[var(--radius)] object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface2)] to-[var(--bg)]" />
                      )}
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-[color:var(--text)]">
                        {festival.is_free ? "FREE" : festival.price_range ?? "PAID"}
                      </div>
                      <button
                        type="button"
                        className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-[color:var(--text)]"
                        aria-label="Bookmark"
                      >
                        ★
                      </button>
                    </AppleCardHeader>
                    <AppleCardBody className="space-y-3">
                      <Heading as="h3" size="h3" className="text-lg">
                        {festival.title}
                      </Heading>
                      <Text variant="muted" size="sm">
                        {festival.city ?? "Bulgaria"} • {formatDateRange(festival.start_date, festival.end_date)}
                      </Text>
                      <div className="flex flex-wrap gap-2">
                        {festival.is_free ? <ApplePill active>Безплатно</ApplePill> : null}
                        {festival.category ? <ApplePill>{festival.category}</ApplePill> : null}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <Link href={`/festival/${festival.slug}`} className="font-semibold">
                          Детайли →
                        </Link>
                        <AppleButton variant="ghost">Добави</AppleButton>
                      </div>
                    </AppleCardBody>
                  </AppleCard>
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
