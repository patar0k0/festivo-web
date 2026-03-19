import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import EventCard from "@/components/ui/EventCard";
import FallbackImage from "@/components/ui/FallbackImage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Festival, OrganizerProfile } from "@/lib/types";
import { getBaseUrl } from "@/lib/seo";
import "../../landing.css";

export const revalidate = 21600;

const FESTIVAL_SELECT_MIN =
  "id,title,slug,city,region,start_date,end_date,category,hero_image,image_url,is_free,status,lat,lng,description,ticket_url,price_range,festival_media(url,type,sort_order)";

async function getOrganizerWithFestivalsServer(slug: string): Promise<{ organizer: OrganizerProfile; festivals: Festival[] } | null> {
  const supabase = await createSupabaseServerClient();

  console.info("[organizer-public] lookup start", { slug });

  const { data: organizer, error: organizerError } = await supabase
    .from("organizers")
    .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,verified")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<OrganizerProfile>();

  if (organizerError) {
    console.error("[organizer-public] organizer lookup error", {
      slug,
      error: organizerError.message,
    });
  }

  console.info("[organizer-public] organizer lookup result", {
    slug,
    found: Boolean(organizer),
    organizerId: organizer?.id ?? null,
    organizerName: organizer?.name ?? null,
  });

  if (!organizer) return null;

  const { data: festivals, error: festivalsError } = await supabase
    .from("festivals")
    .select(FESTIVAL_SELECT_MIN)
    .eq("organizer_id", organizer.id)
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .order("start_date", { ascending: true })
    .returns<Festival[]>();

  if (festivalsError) {
    throw new Error(festivalsError.message);
  }

  return { organizer, festivals: festivals ?? [] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getOrganizerWithFestivalsServer(slug);
  if (!data) return {};

  const title = `${data.organizer.name} | Организатор | Festivo`;
  const description = data.organizer.description?.trim() || `Профил на организатор ${data.organizer.name} във Festivo.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${getBaseUrl()}/organizers/${slug}`,
    },
  };
}

export default async function OrganizerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getOrganizerWithFestivalsServer(slug);
  if (!data) return notFound();

  const { organizer, festivals } = data;
  const organizerInitials = organizer.name
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const fallbackCity = festivals.find((festival) => festival.city)?.city;

  return (
    <div className="landing-bg text-[#0c0e14]">
      <Section className="py-8 md:py-12">
        <Container>
          <div className="mx-auto max-w-6xl space-y-7 md:space-y-8">
            <section className="rounded-3xl border border-black/[0.06] bg-white/95 p-5 shadow-[0_1px_0_rgba(12,14,20,0.04),0_16px_38px_rgba(12,14,20,0.08)] md:p-7 lg:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-7">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-[#eef2ff] to-[#e6ecff] ring-1 ring-black/5 md:h-28 md:w-28">
                  {organizer.logo_url ? (
                    <FallbackImage src={organizer.logo_url} alt={organizer.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold tracking-wide text-black/55">{organizerInitials || "OF"}</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Организатор на събития</p>
                  <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-black md:text-3xl">{organizer.name}</h1>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-black/70">
                    <span className="inline-flex items-center rounded-full bg-black/[0.045] px-3 py-1.5 font-medium">
                      {festivals.length} {festivals.length === 1 ? "фестивал" : "фестивала"}
                    </span>

                    {fallbackCity ? (
                      <span className="inline-flex items-center rounded-full bg-black/[0.045] px-3 py-1.5 font-medium">{fallbackCity}</span>
                    ) : null}

                    {organizer.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        <span aria-hidden="true">✓</span>
                        Потвърден профил
                      </span>
                    ) : null}
                  </div>

                  {(organizer.website_url || organizer.facebook_url || organizer.instagram_url) ? (
                    <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
                      {organizer.website_url ? (
                        <a
                          href={organizer.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-black/10 bg-white px-3.5 py-1.5 font-medium text-black/70 transition hover:border-black/20 hover:text-black"
                        >
                          Уебсайт
                        </a>
                      ) : null}

                      {organizer.facebook_url ? (
                        <a
                          href={organizer.facebook_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2]/10 px-3.5 py-1.5 font-semibold text-[#155ec0] ring-1 ring-[#1877F2]/20 transition hover:bg-[#1877F2]/15"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                            <path d="M13.74 22v-8.01h2.7l.4-3.12h-3.1V8.88c0-.9.25-1.5 1.54-1.5h1.65V4.6c-.29-.04-1.27-.12-2.4-.12-2.38 0-4.01 1.46-4.01 4.14v2.3H7.8v3.12h2.72V22h3.22Z" />
                          </svg>
                          Facebook
                        </a>
                      ) : null}

                      {organizer.instagram_url ? (
                        <a
                          href={organizer.instagram_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full bg-[#E1306C]/10 px-3.5 py-1.5 font-semibold text-[#bf2558] ring-1 ring-[#E1306C]/20 transition hover:bg-[#E1306C]/15"
                        >
                          Instagram
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-black/[0.06] bg-white/95 p-5 shadow-[0_1px_0_rgba(12,14,20,0.04),0_14px_34px_rgba(12,14,20,0.07)] md:p-7">
              <h2 className="text-xl font-semibold tracking-tight text-black md:text-2xl">За организатора</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-black/70 md:text-[15px]">
                {organizer.description?.trim() || "Този организатор все още няма добавено описание."}
              </p>
            </section>

            <section className="space-y-4 md:space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-black md:text-2xl">Фестивали от този организатор</h2>
                <Link
                  href="/festivals"
                  className="inline-flex items-center rounded-full bg-black/[0.04] px-3 py-1.5 text-sm font-medium text-black/70 transition hover:bg-black/[0.07] hover:text-black"
                >
                  Всички фестивали
                </Link>
              </div>

              {festivals.length ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {festivals.map((festival) => (
                    <EventCard
                      key={festival.id}
                      title={festival.title}
                      city={festival.city}
                      category={festival.category}
                      imageUrl={festival.hero_image ?? festival.image_url}
                      startDate={festival.start_date}
                      endDate={festival.end_date}
                      isFree={festival.is_free}
                      detailsHref={`/festivals/${festival.slug}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-black/[0.06] bg-white p-5 text-sm text-black/65 shadow-[0_1px_0_rgba(12,14,20,0.05),0_12px_28px_rgba(12,14,20,0.08)]">
                  Няма публикувани фестивали за този организатор.
                </div>
              )}
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
