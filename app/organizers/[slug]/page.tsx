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
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="landing-bg text-[#0c0e14]">
      <Section className="py-8 md:py-10">
        <Container>
          <div className="grid gap-7 lg:grid-cols-[320px,1fr] xl:grid-cols-[360px,1fr]">
            <aside className="h-fit rounded-3xl bg-white p-6 shadow-[0_1px_0_rgba(12,14,20,0.05),0_16px_38px_rgba(12,14,20,0.08)]">
              <div className="flex items-start gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#f5f7fb] ring-1 ring-black/5">
                  {organizer.logo_url ? (
                    <FallbackImage src={organizer.logo_url} alt={organizer.name} fill className="object-contain p-3" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold tracking-wide text-black/50">
                      {organizerInitials || "OF"}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-black/60">
                    Организатор
                  </span>
                  <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{organizer.name}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60">
                    {organizer.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        <span aria-hidden="true">✓</span>
                        Потвърден профил
                      </span>
                    ) : null}
                    <span className="inline-flex rounded-full bg-black/[0.04] px-2.5 py-1 font-medium">
                      {festivals.length} {festivals.length === 1 ? "фестивал" : "фестивала"}
                    </span>
                  </div>
                </div>
              </div>

              {organizer.description ? <p className="mt-5 text-sm leading-relaxed text-black/70">{organizer.description}</p> : null}

              <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
                {organizer.website_url ? (
                  <a
                    href={organizer.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full bg-black/[0.04] px-3 py-1.5 font-medium text-black/70 transition hover:bg-black/[0.07] hover:text-black"
                  >
                    Уебсайт
                  </a>
                ) : null}
                {organizer.facebook_url ? (
                  <a
                    href={organizer.facebook_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full bg-black/[0.04] px-3 py-1.5 font-medium text-black/70 transition hover:bg-black/[0.07] hover:text-black"
                  >
                    Facebook
                  </a>
                ) : null}
              </div>
            </aside>

            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">Фестивали ({festivals.length})</h2>
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
                <div className="rounded-2xl bg-white p-5 text-sm text-black/65 shadow-[0_1px_0_rgba(12,14,20,0.05),0_12px_28px_rgba(12,14,20,0.08)]">
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
