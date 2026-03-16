import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import EventCard from "@/components/ui/EventCard";
import FallbackImage from "@/components/ui/FallbackImage";
import { getOrganizerWithFestivals } from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";
import "../../landing.css";

export const revalidate = 21600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getOrganizerWithFestivals(slug);
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
  const data = await getOrganizerWithFestivals(slug);
  if (!data) return notFound();

  const { organizer, festivals } = data;

  return (
    <div className="landing-bg text-[#0c0e14]">
      <Section className="py-8 md:py-10">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <aside className="rounded-2xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
              <div className="relative h-40 w-full overflow-hidden rounded-xl bg-black/[0.04]">
                {organizer.logo_url ? (
                  <FallbackImage src={organizer.logo_url} alt={organizer.name} fill className="object-contain p-4" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-black/45">Няма лого</div>
                )}
              </div>
              <h1 className="mt-4 text-2xl font-bold">{organizer.name}</h1>
              {organizer.description ? <p className="mt-3 text-sm text-black/70">{organizer.description}</p> : null}

              <div className="mt-5 space-y-2 text-sm">
                {organizer.website_url ? (
                  <a href={organizer.website_url} target="_blank" rel="noreferrer" className="block text-black/80 underline">
                    Уебсайт
                  </a>
                ) : null}
                {organizer.facebook_url ? (
                  <a href={organizer.facebook_url} target="_blank" rel="noreferrer" className="block text-black/80 underline">
                    Facebook
                  </a>
                ) : null}
                {organizer.instagram_url ? (
                  <a href={organizer.instagram_url} target="_blank" rel="noreferrer" className="block text-black/80 underline">
                    Instagram
                  </a>
                ) : null}
              </div>
            </aside>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Фестивали ({festivals.length})</h2>
                <Link href="/festivals" className="text-sm font-medium text-black/70 underline">Всички фестивали</Link>
              </div>

              {festivals.length ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 text-sm text-black/65">
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
