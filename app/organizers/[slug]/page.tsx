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

  return (
    <div className="landing-bg text-[#0c0e14]">
      <Section className="py-8 md:py-10">
        <Container>
          <div className="grid gap-7 lg:grid-cols-[320px,1fr] xl:grid-cols-[360px,1fr]">
            <aside className="h-fit rounded-3xl bg-white p-6 shadow-[0_1px_0_rgba(12,14,20,0.05),0_16px_38px_rgba(12,14,20,0.08)]">
              <div className="flex items-start gap-5">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#eef2ff] to-[#e6ecff] ring-1 ring-black/5">
                  {organizer.logo_url ? (
                    <FallbackImage src={organizer.logo_url} alt={organizer.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold tracking-wide text-black/55">
                      {organizerInitials || "OF"}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-[2.65rem]">{organizer.name}</h1>
                  <p className="mt-1 text-sm font-medium text-black/55">Организатор на събития</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-black/60">
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

              {organizer.description ? <p className="mt-7 text-sm leading-relaxed text-black/70">{organizer.description}</p> : null}

              <div className="mt-6 flex flex-wrap gap-2.5 text-sm">
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
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2]/10 px-3 py-1.5 font-semibold text-[#155ec0] ring-1 ring-[#1877F2]/20 transition hover:bg-[#1877F2]/15"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                      <path d="M13.74 22v-8.01h2.7l.4-3.12h-3.1V8.88c0-.9.25-1.5 1.54-1.5h1.65V4.6c-.29-.04-1.27-.12-2.4-.12-2.38 0-4.01 1.46-4.01 4.14v2.3H7.8v3.12h2.72V22h3.22Z" />
                    </svg>
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
