import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import EventCard from "@/components/ui/EventCard";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import OrganizerProfileLogo from "@/components/organizers/OrganizerProfileLogo";
import {
  getOrganizerWithFestivals,
  normalizePublicOrganizerSlugParam,
  resolveOrganizerCanonicalSlug,
} from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";
import { hasActivePromotion } from "@/lib/monetization";
import "../../landing.css";

/** Avoid caching a stale 404 after the organizer row appears or slug is fixed (ISR + notFound). */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicOrganizerSlugParam(rawSlug);
  const data = await getOrganizerWithFestivals(slug);
  if (!data) {
    const canonical = await resolveOrganizerCanonicalSlug(slug);
    if (canonical && canonical !== slug) permanentRedirect(`/organizers/${canonical}`);
    return {};
  }

  const title = `${data.organizer.name} | Организатор | Festivo`;
  const description = data.organizer.description?.trim() || `Профил на организатор ${data.organizer.name} във Festivo.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${getBaseUrl()}/organizers/${encodeURIComponent(data.organizer.slug)}`,
    },
  };
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`;
}

export default async function OrganizerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicOrganizerSlugParam(rawSlug);
  const data = await getOrganizerWithFestivals(slug);
  if (!data) {
    const canonical = await resolveOrganizerCanonicalSlug(slug);
    if (canonical && canonical !== slug) permanentRedirect(`/organizers/${canonical}`);
    return notFound();
  }

  const { organizer, festivals } = data;
  const organizerInitials = organizer.name
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const cityFromProfile = organizer.city_name_display?.trim();
  const cityFromFestivals = festivals.find((festival) => festival.city_name_display?.trim())?.city_name_display?.trim();
  const locationLabel = cityFromProfile || cityFromFestivals || null;

  const email = organizer.email?.trim() || null;
  const phone = organizer.phone?.trim() || null;
  const description = organizer.description?.trim() || null;

  return (
    <div className="landing-bg bg-[#f6f7fb] text-[#0c0e14]">
      <Section className="py-8 md:py-12">
        <Container>
          <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
            <section className="rounded-3xl border border-black/[0.05] bg-white p-6 shadow-sm md:p-8 lg:p-9">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
                <OrganizerProfileLogo logoUrl={organizer.logo_url} name={organizer.name} initials={organizerInitials} />

                <div className="min-w-0 flex-1 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Организатор на събития</p>
                    <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-slate-950 md:text-4xl">{organizer.name}</h1>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 font-medium">
                      {festivals.length} {festivals.length === 1 ? "фестивал" : "фестивала"}
                    </span>

                    {locationLabel ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 font-medium">{locationLabel}</span>
                    ) : null}

                    {organizer.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        <span aria-hidden="true">✓</span>
                        Потвърден организатор
                      </span>
                    ) : null}
                  </div>

                  {(organizer.website_url || organizer.facebook_url || organizer.instagram_url) ? (
                    <div className="flex flex-wrap gap-2.5 text-sm">
                      {organizer.website_url ? (
                        <a
                          href={organizer.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1.5 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
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

                  {(email || phone) ? (
                    <div className="border-t border-slate-100 pt-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Контакт</p>
                      <div className="mt-3 flex flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
                        {email ? (
                          <a href={`mailto:${email}`} className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500">
                            {email}
                          </a>
                        ) : null}
                        {phone ? (
                          <a href={telHref(phone)} className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500">
                            {phone}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {description ? (
                    <div className="border-t border-slate-100 pt-5">
                      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">За организатора</h2>
                      <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-600 md:text-base">{description}</p>
                    </div>
                  ) : (
                    <p className="border-t border-slate-100 pt-5 text-sm leading-7 text-slate-500">Този организатор все още няма добавено описание.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4 md:space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Фестивали от този организатор</h2>
                <Link
                  href="/festivals"
                  className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                >
                  Всички фестивали
                </Link>
              </div>

              {festivals.length ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {festivals.map((festival) => (
                    <EventCard
                      key={festival.id}
                      title={festival.title}
                      city={festivalCityLabel(festival)}
                      category={festival.category}
                      imageUrl={festival.hero_image ?? festival.image_url}
                      startDate={festival.start_date}
                      endDate={festival.end_date}
                      isFree={festival.is_free}
                      isPromoted={hasActivePromotion(festival)}
                      detailsHref={`/festivals/${festival.slug}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-black/[0.06] bg-white p-6 text-sm text-slate-600 shadow-sm">
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
