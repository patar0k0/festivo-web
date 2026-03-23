"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { bg } from "date-fns/locale";
import Badge from "@/components/ui/Badge";
import EventCard from "@/components/ui/EventCard";
import Select from "@/components/ui/Select";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import { cityHref } from "@/lib/cities";
import FestivalGallery from "@/components/festival/FestivalGallery";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import type { ReminderType } from "@/lib/plan/server";
import type { Festival, FestivalDay, FestivalMedia, FestivalScheduleItem } from "@/lib/types";
import { formatFestivalDateLineLongBg, primaryFestivalDate } from "@/lib/festival/listingDates";
import { FESTIVAL_PROGRAM_SECTION_ID } from "@/lib/festival/programmeAnchor";

type Props = {
  festival: Festival;
  media: FestivalMedia[];
  days: FestivalDay[];
  scheduleItems: FestivalScheduleItem[];
  mapHref: string | null;
  mapEmbedSrc: string | null;
  citySlug: string | null;
  calendarMonth: string | null;
  relatedFestivals: Festival[];
  /** Линк към админ формата за редакция; показва се само за логнати админи. */
  adminEditHref?: string | null;
};

type GroupedDay = {
  id: string;
  label: string;
  items: FestivalScheduleItem[];
};

function formatDayLabel(day: FestivalDay): string {
  if (day.title) return day.title;
  if (!day.date) return "Ден";
  try {
    return format(parseISO(day.date), "d MMMM", { locale: bg });
  } catch {
    return day.date;
  }
}

function sortScheduleItems(items: FestivalScheduleItem[]): FestivalScheduleItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.start_time ?? "99:99";
    const bTime = b.start_time ?? "99:99";
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return (a.sort_order ?? 9999) - (b.sort_order ?? 9999);
  });
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  const from = start ? start.slice(0, 5) : "";
  const to = end ? end.slice(0, 5) : "";
  if (from && to) return `${from} - ${to}`;
  return from || "Час предстои";
}

function categoryLabel(category?: string | null): string | null {
  if (!category) return null;
  const labels: Record<string, string> = {
    music: "Музика",
    folk: "Фолклор",
    arts: "Изкуство",
    food: "Храна",
    cultural: "Култура",
    sports: "Спорт",
    film: "Кино",
    theater: "Театър",
  };
  return labels[category.toLowerCase()] ?? category;
}

function getGroupedDays(days: FestivalDay[], items: FestivalScheduleItem[]): GroupedDay[] {
  if (!days.length) {
    if (!items.length) return [];
    return [
      {
        id: "all",
        label: "Програма",
        items: sortScheduleItems(items),
      },
    ];
  }

  return days.map((day) => ({
    id: String(day.id),
    label: formatDayLabel(day),
    items: sortScheduleItems(items.filter((item) => String(item.day_id) === String(day.id))),
  }));
}

function isImageMedia(type?: string | null): boolean {
  if (!type) return true;
  return type.toLowerCase().includes("image");
}

function normalizeHeroUrl(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export default function FestivalDetailClient({
  festival,
  media,
  days,
  scheduleItems,
  mapHref,
  mapEmbedSrc,
  citySlug,
  calendarMonth,
  relatedFestivals,
  adminEditHref,
}: Props) {
  const groupedDays = useMemo(() => getGroupedDays(days, scheduleItems), [days, scheduleItems]);
  const sortedScheduleItems = useMemo(() => sortScheduleItems(scheduleItems), [scheduleItems]);
  const [activeDayId, setActiveDayId] = useState(groupedDays[0]?.id ?? "");
  const [isPlanButtonLoading, setIsPlanButtonLoading] = useState(false);
  const [festivalPlanError, setFestivalPlanError] = useState<string | null>(null);
  const {
    isAuthenticated,
    festivalIds,
    isScheduleItemInPlan,
    toggleScheduleItem,
    setFestivalInPlan,
    reminderTypeByFestivalId,
    setFestivalReminder,
  } = usePlanState();

  const displayedDay = groupedDays.find((day) => day.id === activeDayId) ?? groupedDays[0] ?? null;
  const selectedItems = useMemo(
    () =>
      sortScheduleItems(
        sortedScheduleItems.filter((item) => isScheduleItemInPlan(String(item.id))),
      ),
    [isScheduleItemInPlan, sortedScheduleItems],
  );
  const festivalInPlan = festivalIds.includes(String(festival.id));
  const reminder = reminderTypeByFestivalId[String(festival.id)] ?? "none";

  const imageMedia = media.filter((item) => isImageMedia(item.type) && Boolean(normalizeHeroUrl(item.url)));
  const heroImage = getFestivalHeroImage({
    ...festival,
    festival_media: media,
  });
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  const galleryItems = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ id: string | number; url: string; caption?: string | null }> = [];
    const add = (id: string | number, url: string | null | undefined, caption?: string | null) => {
      const u = normalizeHeroUrl(url);
      if (!u || seen.has(u)) return;
      seen.add(u);
      out.push({ id, url: u, caption });
    };
    if (heroImage && !heroImageFailed) {
      add(`hero-${festival.id}`, heroImage, null);
    }
    for (const m of imageMedia) {
      add(m.id, m.url, m.caption);
    }
    return out;
  }, [festival.id, heroImage, heroImageFailed, imageMedia]);
  const categoryText = categoryLabel(festival.category);
  const formattedDateRange = formatFestivalDateLineLongBg(festival);
  const descriptionText = festival.description?.trim() ?? "";
  const tags = (festival.tags ?? []).filter((tag): tag is string => Boolean(tag?.trim()));
  const visibleTags = tags.slice(0, 7);
  const hiddenTagsCount = Math.max(tags.length - visibleTags.length, 0);
  const priceRange = festival.price_range?.trim() ?? "";
  const showFreeBadge = festival.is_free === true;
  const showPriceRange = Boolean(priceRange) && !showFreeBadge;
  const showDescriptionSection = Boolean(descriptionText) || tags.length > 0 || showPriceRange || showFreeBadge;
  const locationName = festival.location_name?.trim() ?? "";
  const cityName = festivalCityLabel(festival, "");
  const cityOrLocationText = cityName || locationName;
  const venueName = festival.venue_name?.trim() ?? "";
  const showVenueName = Boolean(venueName) && venueName.toLocaleLowerCase() !== locationName.toLocaleLowerCase();
  const hasProgramContent = groupedDays.some((day) => day.items.length > 0);
  const hasGalleryContent = galleryItems.length > 0;
  const linkedOrganizers = (festival.organizers ?? [])
    .map((row) => ({
      name: row.name?.trim() ?? "",
      slug: row.slug?.trim() ?? "",
    }))
    .filter((row) => Boolean(row.name));
  const organizerName = festival.organizer_name?.trim() || festival.organizer?.name?.trim() || "";
  const organizerSlug = festival.organizer?.slug?.trim() || "";
  const fallbackOrganizers = organizerName ? [{ name: organizerName, slug: organizerSlug }] : [];
  const displayOrganizers = linkedOrganizers.length ? linkedOrganizers : fallbackOrganizers;
  const showOrganizer = displayOrganizers.length > 0;
  const showInfoSection = Boolean(
    formattedDateRange ||
      locationName ||
      showVenueName ||
      festival.address?.trim() ||
      showOrganizer ||
      festival.region?.trim(),
  );
  const showMapSection = Boolean(mapEmbedSrc && mapHref && (locationName || cityName || festival.address?.trim()));
  const hasCtaButtons = Boolean(festival.website_url || festival.ticket_url);

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImage]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.debug(
      `[festival-detail] slug=${festival.slug} hero_image="${festival.hero_image ?? ""}" media_count=${imageMedia.length} resolved_hero="${heroImage ?? ""}"`
    );
  }, [festival.slug, festival.hero_image, imageMedia.length, heroImage]);

  const clearPlan = async () => {
    const ids = selectedItems.map((item) => String(item.id));
    for (const itemId of ids) {
      await toggleScheduleItem(itemId);
    }
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <section className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)]">
        <div className="relative h-[260px] sm:h-[320px] md:h-[360px]">
          {adminEditHref ? (
            <Link
              href={adminEditHref}
              className="absolute right-3 top-3 z-20 rounded-xl border border-white/45 bg-black/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:border-white/70 hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/80"
            >
              Редакция
            </Link>
          ) : null}
          {heroImage && !heroImageFailed ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Hero image URL can be external/unknown at runtime and needs direct fallback handling via onError. */}
              <img
                src={heroImage}
                alt={festival.title || "Festival"}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => {
                  setHeroImageFailed(true);
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
            </>
          ) : heroImage ? (
            <div className="absolute inset-0 bg-gradient-to-br from-[#ece8df] via-[#f3efe7] to-[#e3ddd2]" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#ece8df] via-[#f4f1e9] to-[#ddd6c9] text-black/45">
              <div className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-center backdrop-blur-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">Няма основна снимка</span>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6 md:p-8">
            <div className="max-w-3xl space-y-2.5 rounded-2xl bg-black/25 p-3 backdrop-blur-[1.5px] sm:p-4 md:max-w-4xl">
              <h1 className="max-w-[22ch] text-xl font-black leading-[1.1] tracking-tight sm:text-2xl sm:leading-[1.05]">
                {festival.title}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/85 sm:text-[11px]">
                {formattedDateRange ? <span className="rounded-full bg-black/35 px-2.5 py-0.5">{formattedDateRange}</span> : null}
                {cityOrLocationText ? <span className="rounded-full bg-black/35 px-2.5 py-0.5">{cityOrLocationText}</span> : null}
                {categoryText ? <span className="rounded-full bg-black/35 px-2.5 py-0.5">{categoryText}</span> : null}
                {showFreeBadge ? <span className="rounded-full bg-black/35 px-2.5 py-0.5">Безплатен вход</span> : null}
                <a
                  href={`#${FESTIVAL_PROGRAM_SECTION_ID}`}
                  className="rounded-full bg-black/35 px-2.5 py-0.5 text-white/95 transition hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Програма
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          {showDescriptionSection ? (
            <section className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
              <h2 className="text-xl font-semibold text-[#0c0e14]">Описание</h2>
              {descriptionText ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-black/65">{descriptionText}</p>
              ) : null}
              {(showFreeBadge || showPriceRange || tags.length > 0) ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {showFreeBadge ? <Badge variant="primary">Безплатен вход</Badge> : null}
                  {showPriceRange ? <Badge variant="neutral">{priceRange}</Badge> : null}
                  {visibleTags.map((tag) => (
                    <Badge key={tag} variant="neutral">#{tag}</Badge>
                  ))}
                  {hiddenTagsCount > 0 ? <Badge variant="neutral">+{hiddenTagsCount}</Badge> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {hasGalleryContent ? (
            <FestivalGallery items={galleryItems} festivalTitle={festival.title || "Фестивал"} />
          ) : null}

          <section
            id={FESTIVAL_PROGRAM_SECTION_ID}
            className="scroll-mt-24 rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]"
          >
            <h2 className="text-xl font-semibold text-[#0c0e14]">Програма</h2>
            {hasProgramContent ? (
              <>
                <p className="mt-2 text-sm text-black/55">
                  Добави конкретни часове в личния си план; запазеният фестивал (встрани) е за цялото събитие и напомнянията.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {groupedDays.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setActiveDayId(day.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                        displayedDay?.id === day.id
                          ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                          : "border-black/[0.1] bg-white text-[#0c0e14] hover:border-black/20 hover:bg-black/[0.03]"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {(displayedDay?.items ?? []).length ? (
                    displayedDay?.items.map((item) => {
                      const itemId = String(item.id);
                      const selected = isScheduleItemInPlan(itemId);
                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border border-black/[0.08] bg-white p-4 shadow-[0_2px_0_rgba(12,14,20,0.03),0_6px_14px_rgba(12,14,20,0.06)]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                                {formatTimeRange(item.start_time, item.end_time)}
                                {item.stage ? ` • ${item.stage}` : ""}
                              </p>
                              <h3 className="text-base font-semibold text-[#0c0e14]">{item.title}</h3>
                              {item.description ? <p className="text-sm text-black/60">{item.description}</p> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                void toggleScheduleItem(itemId);
                              }}
                              className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                                selected
                                  ? "border-[#0c0e14] bg-[#0c0e14] text-white hover:bg-[#1d202b]"
                                  : "border-black/[0.1] bg-white text-[#0c0e14] hover:border-black/20 hover:bg-black/[0.03]"
                              }`}
                            >
                              {selected ? "Премахни от програмата" : "Добави в програмата"}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="text-sm text-black/55">Няма публикувани точки за избрания ден.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-black/55">
                <p>
                  {groupedDays.length > 0
                    ? "Дните са въведени, но часовете от програмата предстоят да бъдат публикувани."
                    : "Все още няма публикуван график за този фестивал."}
                </p>
                {festival.website_url ? (
                  <p className="mt-2">
                    <a
                      href={festival.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#0c0e14] underline-offset-2 hover:underline"
                    >
                      Официален сайт
                    </a>
                    <span className="text-black/45"> — може да има актуална програма.</span>
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {relatedFestivals.length ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[#0c0e14]">Още фестивали в {cityName || "региона"}</h2>
                <div className="flex flex-wrap gap-3 text-sm font-semibold text-[#0c0e14]">
                  {citySlug ? <Link href={cityHref(citySlug)}>Страница на града</Link> : null}
                  {calendarMonth ? <Link href={`/calendar/${calendarMonth}`}>Календар за месеца</Link> : null}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {relatedFestivals.slice(0, 4).map((item) => (
                  <Link key={item.slug} href={`/festivals/${item.slug}`} className="block">
                    <EventCard
                      title={item.title}
                      city={festivalCityLabel(item)}
                      category={item.category}
                      imageUrl={item.image_url}
                      startDate={primaryFestivalDate(item)}
                      endDate={item.end_date}
                      dateLine={formatFestivalDateLineLongBg(item)}
                      isFree={item.is_free}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[90px]">
          {showInfoSection ? (
            <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
              <h2 className="text-lg font-semibold text-[#0c0e14]">Информация</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {formattedDateRange ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Дата</dt>
                    <dd className="mt-1 text-black/70">{formattedDateRange}</dd>
                  </div>
                ) : null}
                {locationName ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Локация</dt>
                    <dd className="mt-1 text-black/70">{locationName}</dd>
                  </div>
                ) : null}
                {showVenueName ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Място</dt>
                    <dd className="mt-1 text-black/70">{venueName}</dd>
                  </div>
                ) : null}
                {festival.address ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Адрес</dt>
                    <dd className="mt-1 text-black/70">{festival.address}</dd>
                  </div>
                ) : null}
                {showOrganizer ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                      {displayOrganizers.length > 1 ? "Организатори" : "Организатор"}
                    </dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-1 text-black/70">
                      {displayOrganizers.map((row, index) => (
                        <span key={`${row.slug || row.name}-${index}`}>
                          {row.slug ? (
                            <Link
                              href={`/organizers/${row.slug}`}
                              className="underline decoration-black/30 underline-offset-2 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                            >
                              {row.name}
                            </Link>
                          ) : (
                            row.name
                          )}
                          {index < displayOrganizers.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {festival.region ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Регион</dt>
                    <dd className="mt-1 text-black/70">{festival.region}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {showMapSection ? (
            <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
              <h2 className="text-lg font-semibold text-[#0c0e14]">Карта и навигация</h2>
              {cityOrLocationText ? (
                citySlug ? (
                  <Link href={cityHref(citySlug)} className="mt-2 inline-block text-sm font-medium text-black/75 underline decoration-black/30 underline-offset-2 hover:text-black">
                    {cityOrLocationText}
                  </Link>
                ) : (
                  <p className="mt-2 text-sm text-black/70">{cityOrLocationText}</p>
                )
              ) : null}
              {festival.address ? <p className="mt-1 text-sm text-black/60">{festival.address}</p> : null}
              <div className="mt-4 overflow-hidden rounded-xl border border-black/[0.1]">
                <iframe
                  title={`Карта: ${festival.title}`}
                  src={mapEmbedSrc ?? undefined}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-56 w-full border-0"
                />
              </div>
              <div className="mt-4">
                <a
                  href={mapHref ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl bg-[#0c0e14] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Навигация
                </a>
              </div>
            </section>
          ) : null}

          {hasCtaButtons ? (
            <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
              <h2 className="text-lg font-semibold text-[#0c0e14]">Полезни връзки</h2>
              <div className="mt-4 flex flex-col gap-2">
                {festival.website_url ? (
                  <a
                    href={festival.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Официален сайт
                  </a>
                ) : null}
                {festival.ticket_url ? (
                  <a
                    href={festival.ticket_url}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-xl border px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                      showFreeBadge
                        ? "border-black/[0.08] bg-[#f8f7f3] text-black/55 hover:bg-[#f0ede6]"
                        : "border-black/[0.1] bg-white text-[#0c0e14] hover:border-black/20 hover:bg-black/[0.03]"
                    }`}
                  >
                    Билети
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

            <section className="rounded-2xl border border-black/[0.08] bg-[#fbfaf7] p-5 shadow-[0_1px_0_rgba(12,14,20,0.04),0_6px_14px_rgba(12,14,20,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-black/80">Запазен фестивал</h2>
              <p className="mt-1 text-xs text-black/50">
                Отделно от часовете в програмата — за списъка „Запазени“ и напомняния към събитието.
              </p>
              {selectedItems.length ? (
                <button
                  type="button"
                  onClick={clearPlan}
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 transition hover:text-black/70"
                >
                  Изчисти
                </button>
              ) : null}
            </div>

            <div className="mt-4">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={async () => {
                    setIsPlanButtonLoading(true);
                    try {
                      setFestivalPlanError(null);
                      const response = await fetch("/api/plan/festivals", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ festivalId: String(festival.id) }),
                      });

                      if (response.status === 401) {
                        setFestivalPlanError("Нужен е вход в профила.");
                        return;
                      }

                      const payload = (await response.json()) as { inPlan?: boolean; error?: string };

                      if (!response.ok) {
                        setFestivalPlanError(payload.error ?? "Възникна грешка при запазване на плана.");
                        return;
                      }

                      setFestivalInPlan(String(festival.id), Boolean(payload.inPlan));
                    } finally {
                      setIsPlanButtonLoading(false);
                    }
                  }}
                  disabled={isPlanButtonLoading}
                  className={`w-full rounded-xl border px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                    festivalInPlan
                      ? "border-[#1e2230] bg-[#1e2230] text-white hover:bg-[#2a3040]"
                      : "border-black/[0.12] bg-white/95 text-black/80 hover:border-black/20 hover:bg-black/[0.03]"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {festivalInPlan ? "Премахни от запазените" : "Запази фестивала"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-black/[0.12] bg-white/95 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-black/45 opacity-70"
                >
                  Запази фестивала
                </button>
              )}
            </div>
            {festivalPlanError ? <p className="mt-2 text-xs text-red-700">{festivalPlanError}</p> : null}

            <div className="mt-4 space-y-2">
              {selectedItems.length ? (
                selectedItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-black/[0.08] bg-white/95 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
                      {formatTimeRange(item.start_time, item.end_time)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0c0e14]">{item.title}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-black/[0.14] bg-[#f5f3ec] px-4 py-5 text-sm text-black/50">
                  От секцията „Програма“ добави отделни часове в плана си.
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Напомняне</label>
              <Select
                value={reminder}
                onChange={(event) => {
                  void setFestivalReminder(String(festival.id), event.target.value as ReminderType);
                }}
                disabled={!isAuthenticated}
                className="border-black/[0.12] bg-white/95 focus:ring-[#ff4c1f]/20"
              >
                <option value="none">Без напомняне</option>
                <option value="24h">24 часа по-рано</option>
                <option value="same_day_09">В деня на събитието в 09:00</option>
              </Select>
              {!isAuthenticated ? (
                <p className="mt-2 text-xs text-black/55">
                  Влез, за да запазваш фестивали и напомняния. <Link href="/login" className="underline">Вход</Link>
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
