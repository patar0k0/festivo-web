import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import EventCard from "@/components/ui/EventCard";
import {
  festivalLocationPrimary,
  festivalLocationSecondary,
  organizerPageLocationLabel,
} from "@/lib/settlements/formatDisplayName";
import { normalizeExternalHttpHref } from "@/lib/urls/externalHref";
import OrganizerProfileLogo from "@/components/organizers/OrganizerProfileLogo";
import OrganizerProfileAbout from "@/components/organizers/OrganizerProfileAbout";
import type { Festival } from "@/lib/types";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import {
  getOrganizerWithFestivals,
  normalizePublicOrganizerSlugParam,
  resolveOrganizerCanonicalSlug,
} from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";

/** Avoid caching a stale 404 after the organizer row appears or slug is fixed (ISR + notFound). */
export const dynamic = "force-dynamic";

function organizerInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  const single = parts[0] ?? name;
  return single.slice(0, 2).toUpperCase();
}

function topCategoriesFromFestivals(festivals: Festival[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const f of festivals) {
    const c = f.category?.trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "bg"))
    .slice(0, limit)
    .map(([cat]) => cat);
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 16h-8.5A2.25 2.25 0 0 1 2 13.75v-8.5A2.25 2.25 0 0 1 4.25 3h4a.75.75 0 0 1 0 1.5h-4Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M6.194 13.915a.75.75 0 0 0 1.06.053l7.25-6.5a.75.75 0 0 0-1-1.12l-7.25 6.5a.75.75 0 0 0-.053 1.06ZM16.78 3.22a.75.75 0 1 0-1.06 1.06L9.47 10.53l1.06 1.06 6.25-6.25a.75.75 0 0 0 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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
  const organizerInitials = organizerInitialsFromName(organizer.name);

  const locationLabel = organizerPageLocationLabel(organizer.cities, festivals);

  const email = organizer.email?.trim() || null;
  const phone = organizer.phone?.trim() || null;
  const description = organizer.description?.trim() || null;
  const verified = Boolean(organizer.verified);
  const categoryChips = topCategoriesFromFestivals(festivals);
  const festivalCount = festivals.length;
  const activeOrganizerFestivals = festivals.filter((f) => getFestivalTemporalState(f) !== "past");
  const pastOrganizerFestivals = festivals.filter((f) => getFestivalTemporalState(f) === "past");

  const websiteHref = normalizeExternalHttpHref(organizer.website_url);
  const facebookHref = normalizeExternalHttpHref(organizer.facebook_url);
  const instagramHref = normalizeExternalHttpHref(organizer.instagram_url);
  const hasSocialOrWeb = Boolean(websiteHref || facebookHref || instagramHref);

  return (
    <div className={pub.page}>
      <Section className={pub.section}>
        <Container>
          <div className="w-full space-y-10 md:space-y-12">
            <section
              aria-labelledby="organizer-profile-heading"
              className={cn(pub.heroMainCard, "relative overflow-hidden")}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-50/80 to-transparent"
                aria-hidden
              />
              <div className="relative flex flex-col gap-8 p-6 sm:p-8 md:flex-row md:items-start md:gap-10 lg:p-10">
                <OrganizerProfileLogo
                  variant="hero"
                  logoUrl={organizer.logo_url}
                  name={organizer.name}
                  initials={organizerInitials}
                  resetKey={organizer.id}
                />

                <div className="min-w-0 flex-1 space-y-6 md:space-y-7">
                  <header className="space-y-3">
                    <p className={pub.eyebrow}>Организатор на събития</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                      <h1
                        id="organizer-profile-heading"
                        className={cn(
                          pub.displayH1,
                          "text-[1.65rem] leading-[1.15] sm:text-3xl",
                        )}
                      >
                        {organizer.name}
                      </h1>
                      {verified ? (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100/80">
                          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path
                              fillRule="evenodd"
                              d="M16.403 8.064C15.796 7.597 15.25 7.053 14.78 6.443a.75.75 0 0 0-1.06-.093l-4.47 3.73-1.94-1.94a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.09-.04l5-4.17a.75.75 0 0 0 .053-1.06Z"
                              clipRule="evenodd"
                            />
                            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM3.5 10a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z" />
                          </svg>
                          Потвърден във Festivo
                        </span>
                      ) : null}
                    </div>
                  </header>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-amber-200/50 bg-white/90 px-3 py-1.5 text-sm font-medium text-[#0c0e14] ring-1 ring-amber-100/30">
                      {festivalCount} {festivalCount === 1 ? "фестивал" : "фестивала"}
                    </span>
                    {locationLabel ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/45 bg-white px-3 py-1.5 text-sm font-medium text-[#0c0e14] ring-1 ring-amber-100/25">
                        <svg className="h-3.5 w-3.5 text-black/40" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M9.69 1.87a.75.75 0 0 1 .62 0l6.25 2.858a.75.75 0 0 1 .44.684v6.728a5.75 5.75 0 0 1-2.33 4.63l-4.21 3.37a.75.75 0 0 1-.94 0l-4.21-3.37a5.75 5.75 0 0 1-2.33-4.63V5.412a.75.75 0 0 1 .44-.684L9.69 1.87ZM10 3.16 4.25 5.79v5.19a4.25 4.25 0 0 0 1.72 3.42l3.53 2.82 3.53-2.82a4.25 4.25 0 0 0 1.72-3.42V5.79L10 3.16Z"
                            clipRule="evenodd"
                          />
                          <path d="M10 7.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM6.25 9.5a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" />
                        </svg>
                        {locationLabel}
                      </span>
                    ) : null}
                    {categoryChips.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center rounded-full border border-violet-200/60 bg-violet-50/80 px-3 py-1.5 text-sm font-medium text-violet-900/90"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <a
                      href="#organizer-festivals"
                      className={cn(pub.btnPrimary, "rounded-full px-5 py-2.5", pub.focusRing)}
                    >
                      Виж всички фестивали
                    </a>
                    <Link
                      href="/festivals"
                      className={cn(pub.btnSecondary, "rounded-full px-5 py-2.5", pub.focusRing)}
                    >
                      Към каталога
                    </Link>
                  </div>

                  {hasSocialOrWeb ? (
                    <div className="space-y-2">
                      <p className={pub.eyebrowMuted}>Връзки</p>
                      <div className="flex flex-wrap gap-2">
                        {websiteHref ? (
                          <a
                            href={websiteHref}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              pub.btnSecondary,
                              "gap-2 rounded-full px-4 py-2 text-sm normal-case",
                              pub.focusRing,
                            )}
                          >
                            Уебсайт
                            <ExternalLinkIcon className="h-3.5 w-3.5 text-black/40" />
                          </a>
                        ) : null}
                        {facebookHref ? (
                          <a
                            href={facebookHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[#1877F2]/12 px-4 py-2 text-sm font-semibold text-[#145dbf] ring-1 ring-[#1877F2]/25 transition hover:bg-[#1877F2]/18"
                          >
                            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current">
                              <path d="M13.74 22v-8.01h2.7l.4-3.12h-3.1V8.88c0-.9.25-1.5 1.54-1.5h1.65V4.6c-.29-.04-1.27-.12-2.4-.12-2.38 0-4.01 1.46-4.01 4.14v2.3H7.8v3.12h2.72V22h3.22Z" />
                            </svg>
                            Facebook
                            <ExternalLinkIcon className="h-3.5 w-3.5 opacity-70" />
                          </a>
                        ) : null}
                        {instagramHref ? (
                          <a
                            href={instagramHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[#E1306C]/10 px-4 py-2 text-sm font-semibold text-[#bf2558] ring-1 ring-[#E1306C]/22 transition hover:bg-[#E1306C]/14"
                          >
                            Instagram
                            <ExternalLinkIcon className="h-3.5 w-3.5 opacity-70" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {email || phone ? (
                    <div className={cn(pub.railCard, "p-4 sm:p-5")}>
                      <p className={pub.eyebrowMuted}>Контакт</p>
                      <dl className="mt-3 space-y-3 text-sm">
                        {email ? (
                          <div>
                            <dt className="text-xs font-medium text-black/50">Имейл</dt>
                            <dd className="mt-0.5">
                              <a
                                href={`mailto:${email}`}
                                className={cn(pub.linkInline, "inline-block underline-offset-4")}
                              >
                                {email}
                              </a>
                            </dd>
                          </div>
                        ) : null}
                        {phone ? (
                          <div>
                            <dt className="text-xs font-medium text-black/50">Телефон</dt>
                            <dd className="mt-0.5">
                              <a
                                href={telHref(phone)}
                                className={cn(pub.linkInline, "inline-block underline-offset-4")}
                              >
                                {phone}
                              </a>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ) : null}

                  {description ? (
                    <OrganizerProfileAbout text={description} />
                  ) : (
                    <div className="border-t border-amber-200/35 pt-6">
                      <div className="rounded-2xl border border-dashed border-amber-200/55 bg-amber-50/40 px-4 py-5 text-center ring-1 ring-amber-100/25 sm:px-6">
                        <p className="text-sm font-medium text-black/70">Все още няма описание на организатора</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-black/55">
                          Когато бъде добавено, ще се покаже тук за посетителите.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section
              id="organizer-festivals"
              aria-labelledby="organizer-festivals-heading"
              className="scroll-mt-24 space-y-5 md:space-y-6"
            >
              <div className={cn(pub.panelAccentBar, "border-l-4 border-l-[#7c2d12]/85")}>
                <h2 id="organizer-festivals-heading" className={cn(pub.sectionTitle, "md:text-2xl")}>
                  Фестивали на {organizer.name}
                </h2>
                <p className={cn(pub.body, "mt-1.5 max-w-2xl leading-relaxed text-black/65")}>
                  Публикувани събития в каталога на Festivo, свързани с този организатор.
                </p>
              </div>

              {festivals.length ? (
                <div className="space-y-10">
                  {activeOrganizerFestivals.length ? (
                    <div className="space-y-4">
                      {pastOrganizerFestivals.length ? (
                        <h3 className={cn(pub.sectionTitleMd, "text-lg text-black/70")}>
                          Предстоящи и текущи
                        </h3>
                      ) : null}
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {activeOrganizerFestivals.map((festival) => (
                          <EventCard
                            key={festival.id}
                            title={festival.title}
                            city={festivalLocationPrimary(festival, "")}
                            citySecondary={festivalLocationSecondary(festival)}
                            category={festival.category}
                            imageUrl={getFestivalHeroImage(festival)}
                            startDate={festival.start_date}
                            endDate={festival.end_date}
                            occurrenceDates={festival.occurrence_dates}
                            startTime={festival.start_time}
                            endTime={festival.end_time}
                            isPromoted={hasActivePromotion(festival)}
                            isVipOrganizer={hasActiveVip(festival.organizer)}
                            detailsHref={`/festivals/${festival.slug}`}
                            festivalId={festival.id}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {pastOrganizerFestivals.length ? (
                    <div className="space-y-4">
                      <h3 className={cn(pub.sectionTitleMd, "text-lg text-black/50")}>Отминали</h3>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {pastOrganizerFestivals.map((festival) => (
                          <EventCard
                            key={festival.id}
                            title={festival.title}
                            city={festivalLocationPrimary(festival, "")}
                            citySecondary={festivalLocationSecondary(festival)}
                            category={festival.category}
                            imageUrl={getFestivalHeroImage(festival)}
                            startDate={festival.start_date}
                            endDate={festival.end_date}
                            occurrenceDates={festival.occurrence_dates}
                            startTime={festival.start_time}
                            endTime={festival.end_time}
                            isPromoted={hasActivePromotion(festival)}
                            isVipOrganizer={hasActiveVip(festival.organizer)}
                            detailsHref={`/festivals/${festival.slug}`}
                            festivalId={festival.id}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className={cn(pub.sectionCardSoft, "p-6 text-sm leading-relaxed text-black/65")}>
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
