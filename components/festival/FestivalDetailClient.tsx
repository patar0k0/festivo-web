"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { bg } from "date-fns/locale";
import Badge from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import EventCard from "@/components/ui/EventCard";
import { pub } from "@/lib/public-ui/styles";
import { useNavigationGeneration } from "@/components/providers/NavigationGenerationProvider";
import { useImageLoadReset } from "@/components/ui/useImageLoadReset";
import { useToast } from "@/components/ui/useToast";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import { cityHref } from "@/lib/cities";
import { FestivalMedia } from "@/components/festival/FestivalMedia";
import type { MediaItem } from "@/components/ui/MediaLightbox";
import { FestivalHeroActionBar, FestivalRailActionBar } from "@/components/festival/FestivalDetailActions";
import FestivalQuickFactsStrip from "@/components/festival/FestivalQuickFactsStrip";
import FestivalAppCta from "@/components/festival/FestivalAppCta";
import FestivalAccommodationSection from "@/components/festival/FestivalAccommodationSection";
import FestivalNearbyBookingCard from "@/components/festival/FestivalNearbyBookingCard";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import {
  formatPublicFestivalLocationSummary,
  getCompactMetaLocationBeyondCity,
  normalizeFestivalLocationText,
} from "@/lib/festival/publicLocationDisplay";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { getFestivalUrgencyLabelBg } from "@/lib/festival/festivalUrgency";
import type { ReminderType } from "@/lib/plan/server";
import type { AccommodationOffer } from "@/lib/accommodation/types";
import type { Festival, FestivalDay, FestivalMediaItem, FestivalScheduleItem } from "@/lib/types";
import { formatFestivalDateLineLongBg, primaryFestivalDate } from "@/lib/festival/listingDates";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { formatScheduleTimeRange, sortByStartTime } from "@/lib/festival/festivalTimeFields";
import { FESTIVAL_PROGRAM_SECTION_ID } from "@/lib/festival/programmeAnchor";
import { outboundClickHref } from "@/lib/outbound/outboundLink";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";

const REMINDER_BLOCK_ID = "festival-reminder-block";

/** Survives navigation to `/login` so „Добави в план“ can complete after auth. */
const PENDING_PLAN_SCHEDULE_ITEM_KEY = "festivo:pendingPlanScheduleItem";

type Props = {
  festival: Festival;
  media: FestivalMediaItem[];
  days: FestivalDay[];
  scheduleItems: FestivalScheduleItem[];
  mapHref: string | null;
  mapEmbedSrc: string | null;
  citySlug: string | null;
  calendarMonth: string | null;
  relatedFestivals: Festival[];
  accommodationOffers: AccommodationOffer[];
  /** Линк към админ формата за редакция; показва се само за логнати админи. */
  adminEditHref?: string | null;
  /** Booking outbound interest (last 30d); server-derived from outbound_clicks. */
  showTravelPopularLabel?: boolean;
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
  return sortByStartTime(items);
}

function earliestScheduleTime(items: FestivalScheduleItem[]): string | null {
  const withTime = items.filter((i) => i.start_time?.trim());
  if (!withTime.length) return null;
  const sorted = sortScheduleItems(withTime);
  const t = sorted[0]?.start_time?.trim();
  return t ? t.slice(0, 5) : null;
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
  if (!type || !type.trim()) return true;
  const t = type.toLowerCase();
  return t !== "video" && !t.includes("video");
}

function normalizeHeroUrl(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

type DisplayOrganizerRow = { name: string; slug: string };

function splitCommaSeparatedOrganizerFallback(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildDisplayOrganizers(festival: Festival): DisplayOrganizerRow[] {
  const linked = (festival.organizers ?? [])
    .map((row) => ({
      name: row.name?.trim() ?? "",
      slug: row.slug?.trim() ?? "",
    }))
    .filter((row) => Boolean(row.name));

  if (linked.length > 0) {
    return linked;
  }

  const rawName = festival.organizer_name?.trim() || festival.organizer?.name?.trim() || "";
  if (!rawName) return [];

  const slug = festival.organizer?.slug?.trim() ?? "";
  const parts = splitCommaSeparatedOrganizerFallback(rawName);
  if (parts.length === 0) return [];

  if (parts.length === 1) {
    return [{ name: parts[0]!, slug }];
  }

  return parts.map((name) => ({ name, slug: "" }));
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
  accommodationOffers,
  adminEditHref,
  showTravelPopularLabel = false,
}: Props) {
  const groupedDays = useMemo(() => getGroupedDays(days, scheduleItems), [days, scheduleItems]);
  const sortedScheduleItems = useMemo(() => sortScheduleItems(scheduleItems), [scheduleItems]);
  const [activeDayId, setActiveDayId] = useState(groupedDays[0]?.id ?? "");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingItem, setPendingItem] = useState<FestivalScheduleItem | null>(null);
  const [reminderPending, setReminderPending] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const reminderFeedbackTimerRef = useRef<number | null>(null);
  const {
    isAuthenticated,
    festivalIds,
    festivalPlanError,
    isScheduleItemInPlan,
    toggleScheduleItem,
    setFestivalReminder,
    reminderTypeByFestivalId,
  } = usePlanState();

  const isGuest = !isAuthenticated;

  const { show, Toast } = useToast();

  const pathname = usePathname();
  const router = useRouter();
  const navigationGeneration = useNavigationGeneration();

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
  /** Retries after aborted/failed loads common on client navigations (same URL would otherwise stay on the error branch until full reload). */
  const [heroLoadAttempt, setHeroLoadAttempt] = useState(0);

  const heroDisplayUrl = useMemo(() => {
    if (!heroImage) return null;
    if (heroLoadAttempt === 0) return heroImage;
    const sep = heroImage.includes("?") ? "&" : "?";
    return `${heroImage}${sep}_festivo_img_retry=${heroLoadAttempt}`;
  }, [heroImage, heroLoadAttempt]);

  const videoPageUrl = useMemo(() => {
    const u = normalizeHeroUrl(festival.video_url);
    return u ?? null;
  }, [festival.video_url]);

  const galleryImages = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const markSeen = (url: string): boolean => {
      const key = url.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    const add = (url: string | null | undefined) => {
      const u = normalizeHeroUrl(url);
      if (!u || !markSeen(u)) return;
      out.push(u);
    };
    const heroUrl = normalizeHeroUrl(heroImage);
    if (heroUrl && markSeen(heroUrl)) {
      out.push(heroUrl);
    }
    for (const m of imageMedia) {
      add(m.url);
    }
    return out;
  }, [heroImage, imageMedia]);

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
  const priceInQuickFactsStrip = showFreeBadge || showPriceRange;
  const cityName = festivalCityLabel(festival, "");
  const locationSummary = formatPublicFestivalLocationSummary(festival);
  const locationBeyondCity =
    locationSummary &&
    (!cityName || normalizeFestivalLocationText(locationSummary) !== normalizeFestivalLocationText(cityName))
      ? locationSummary
      : "";
  const compactLocationBeyondCity = getCompactMetaLocationBeyondCity(festival, cityName);
  const cityOrLocationText = [cityName, compactLocationBeyondCity].filter(Boolean).join(" · ");
  const hasProgramContent = groupedDays.some((day) => day.items.length > 0);
  const mediaItems = useMemo<MediaItem[]>(
    () => [
      ...galleryImages.map((url) => ({ type: "image" as const, url })),
      ...(videoPageUrl ? [{ type: "video" as const, url: videoPageUrl }] : []),
    ],
    [galleryImages, videoPageUrl],
  );
  const showMediaSection = mediaItems.length >= 1;
  const urgencyLabel = getFestivalUrgencyLabelBg(festival);
  const temporalState = useMemo(() => getFestivalTemporalState(festival), [festival]);
  const isPastFestival = temporalState === "past";
  const icsHref = `/festival/${festival.slug}/ics`;
  const timeLine = earliestScheduleTime(scheduleItems);
  const quickFactSegments = useMemo(() => {
    const segments: { key: string; label: string; value: string }[] = [];
    const whereValue = [cityName, compactLocationBeyondCity].filter(Boolean).join(" · ");
    if (whereValue) segments.push({ key: "where", label: "Къде", value: whereValue });
    if (formattedDateRange) segments.push({ key: "date", label: "Дата", value: formattedDateRange });
    if (timeLine) segments.push({ key: "time", label: "Час", value: `от ${timeLine}` });
    if (showFreeBadge) segments.push({ key: "price", label: "Вход", value: "Безплатно" });
    else if (showPriceRange) segments.push({ key: "price", label: "Цена", value: priceRange });
    return segments;
  }, [cityName, compactLocationBeyondCity, formattedDateRange, timeLine, showFreeBadge, showPriceRange, priceRange]);

  const displayOrganizers = buildDisplayOrganizers(festival);
  const showOrganizer = displayOrganizers.length > 0;
  const showInfoSection = Boolean(formattedDateRange || locationSummary || showOrganizer);
  const showMapSection = Boolean(mapEmbedSrc && mapHref && (cityName || locationSummary));
  const hasCtaButtons = Boolean(festival.website_url || festival.ticket_url);
  const nearbyBookingPlace = cityOrLocationText.trim();
  const mapLocationBlurb = locationBeyondCity || null;
  const showNearbyBookingCard = Boolean(nearbyBookingPlace && festival.start_date?.trim());
  const reminderOptions: Array<{ value: ReminderType; label: string; helper: string }> = [
    { value: "24h", label: "1 ден по-рано", helper: "Най-често избирано" },
    { value: "same_day_09", label: "В деня в 09:00", helper: "Сутрин, преди да тръгнеш" },
    { value: "none", label: "Без напомняне", helper: "Можеш да го включиш по всяко време" },
  ];

  const descriptionNeedsToggle = descriptionText.length > 480;

  useImageLoadReset(
    () => {
      setHeroImageFailed(false);
      setHeroLoadAttempt(0);
    },
    festival.id,
    heroImage,
    pathname,
  );

  useEffect(() => {
    return () => {
      if (reminderFeedbackTimerRef.current) {
        window.clearTimeout(reminderFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.debug(
      `[festival-detail] slug=${festival.slug} hero_image="${festival.hero_image ?? ""}" media_count=${imageMedia.length} resolved_hero="${heroImage ?? ""}"`,
    );
  }, [festival.slug, festival.hero_image, imageMedia.length, heroImage]);

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 1200);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(PENDING_PLAN_SCHEDULE_ITEM_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { festivalId?: unknown; scheduleItemId?: unknown };
      const festivalId = parsed.festivalId != null ? String(parsed.festivalId) : "";
      const scheduleItemId = parsed.scheduleItemId != null ? String(parsed.scheduleItemId) : "";
      if (!festivalId || !scheduleItemId || festivalId !== String(festival.id)) return;
      const found = scheduleItems.find((i) => String(i.id) === scheduleItemId);
      if (!found) {
        sessionStorage.removeItem(PENDING_PLAN_SCHEDULE_ITEM_KEY);
        return;
      }
      sessionStorage.removeItem(PENDING_PLAN_SCHEDULE_ITEM_KEY);
      setPendingItem(found);
    } catch {
      try {
        sessionStorage.removeItem(PENDING_PLAN_SCHEDULE_ITEM_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [festival.id, scheduleItems]);

  useEffect(() => {
    if (!isAuthenticated || !pendingItem) return;
    const item = pendingItem;
    setPendingItem(null);
    setShowLogin(false);
    void (async () => {
      await toggleScheduleItem(String(item.id));
      show(`Добавено: ${item.title}`);
      setHighlightId(String(item.id));
    })();
  }, [isAuthenticated, pendingItem, toggleScheduleItem, show]);

  const clearPlan = async () => {
    const ids = selectedItems.map((item) => String(item.id));
    for (const itemId of ids) {
      await toggleScheduleItem(itemId);
    }
  };

  const reminderSuccessMessage = (value: ReminderType): string => {
    if (value === "none") return "Напомнянето е изключено.";
    if (value === "24h") return "Ще ти напомним 1 ден по-рано.";
    return "Ще ти напомним в деня в 09:00.";
  };

  const urgencyHeroLabel =
    urgencyLabel === "Днес"
      ? "📅 Днес"
      : urgencyLabel === "Този уикенд"
        ? "🔥 Този уикенд"
        : urgencyLabel?.startsWith("Започва след")
          ? `⏳ ${urgencyLabel}`
          : urgencyLabel;

  return (
    <div className="space-y-6 md:space-y-8">
      {showLogin ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-sm rounded-xl bg-white p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold">Влез в профила си</h2>

            <p className="mb-4 text-sm text-black/60">
              Влез, за да добавяш в план и да получаваш напомняния.
            </p>

            <button
              type="button"
              onClick={() => {
                if (pendingItem) {
                  try {
                    sessionStorage.setItem(
                      PENDING_PLAN_SCHEDULE_ITEM_KEY,
                      JSON.stringify({
                        festivalId: String(festival.id),
                        scheduleItemId: String(pendingItem.id),
                      }),
                    );
                  } catch {
                    /* ignore */
                  }
                }
                const next =
                  pathname && pathname.startsWith("/") && !pathname.startsWith("//")
                    ? pathname
                    : `/festivals/${festival.slug}`;
                router.push(`/login?next=${encodeURIComponent(next)}`);
              }}
              className="w-full rounded-full bg-[#7c2d12] py-2 text-white"
            >
              Вход
            </button>

            <button
              type="button"
              onClick={() => {
                setShowLogin(false);
                setPendingItem(null);
                try {
                  const raw = sessionStorage.getItem(PENDING_PLAN_SCHEDULE_ITEM_KEY);
                  if (!raw) return;
                  const parsed = JSON.parse(raw) as { festivalId?: unknown };
                  if (String(parsed.festivalId ?? "") === String(festival.id)) {
                    sessionStorage.removeItem(PENDING_PLAN_SCHEDULE_ITEM_KEY);
                  }
                } catch {
                  /* ignore */
                }
              }}
              className="mt-2 text-sm text-black/50"
            >
              Затвори
            </button>
          </div>
        </div>
      ) : null}
      <Toast />
      <section className={pub.heroMainCard}>
        <div className="relative h-[260px] sm:h-[320px] md:h-[360px]">
          {heroImage && !heroImageFailed ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Hero image URL can be external/unknown at runtime and needs direct fallback handling via onError. */}
              <img
                key={`${festival.id}-${heroDisplayUrl}-ng${navigationGeneration}`}
                src={heroDisplayUrl ?? heroImage}
                alt={festival.title || "Festival"}
                className="h-full w-full object-cover"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={() => {
                  setHeroLoadAttempt((c) => {
                    if (c < 2) return c + 1;
                    setHeroImageFailed(true);
                    return c;
                  });
                }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/38 via-black/14 to-transparent" />
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
          {heroImage && !heroImageFailed ? (
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/5 shadow-[inset_0_-32px_48px_-12px_rgba(0,0,0,0.18)]"
              aria-hidden
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/28 to-black/10" aria-hidden />
          )}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6 md:p-8">
            <div className="max-w-3xl space-y-3 rounded-2xl bg-black/34 p-3.5 backdrop-blur-[2px] ring-1 ring-inset ring-white/10 sm:p-4 md:max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="max-w-[22ch] text-xl font-semibold leading-[1.03] tracking-tight text-white sm:text-2xl sm:leading-[1.02]">
                  {festival.title}
                </h1>
                {urgencyHeroLabel ? (
                  <span className="rounded-full border border-white/20 bg-black/32 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/95 shadow-sm backdrop-blur-[1px] sm:text-[11px]">
                    {urgencyHeroLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 sm:text-[11px]">
                {formattedDateRange ? <span className="rounded-full bg-black/40 px-2.5 py-0.5">{formattedDateRange}</span> : null}
                {cityOrLocationText ? <span className="rounded-full bg-black/40 px-2.5 py-0.5">{cityOrLocationText}</span> : null}
                {categoryText ? <span className="rounded-full bg-black/40 px-2.5 py-0.5">{categoryText}</span> : null}
                {showFreeBadge ? <span className="rounded-full bg-[#0f8a4d]/70 px-2.5 py-0.5 text-white">Безплатен вход</span> : null}
                {hasActivePromotion(festival) ? (
                  <span className="rounded-full bg-amber-500/70 px-2.5 py-0.5 text-white">Промотирано</span>
                ) : null}
                {hasActiveVip(festival.organizer) ? (
                  <span className="rounded-full bg-violet-500/70 px-2.5 py-0.5 text-white">VIP организатор</span>
                ) : null}
                {showPriceRange ? <span className="rounded-full bg-black/45 px-2.5 py-0.5">{priceRange}</span> : null}
                <a
                  href={`#${FESTIVAL_PROGRAM_SECTION_ID}`}
                  className="rounded-full bg-black/40 px-2.5 py-0.5 text-white/95 transition-all duration-150 hover:bg-black/45 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Програма
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-black/[0.06] bg-white px-4 py-4 sm:px-6">
          {isPastFestival ? (
            <div className="mb-4 rounded-xl border border-black/[0.06] bg-[#faf9f7] px-3.5 py-3 text-sm text-black/60 transition-all duration-200 hover:shadow-md hover:-translate-y-px">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/60">Отминал фестивал</p>
              <p className="mt-1.5 leading-relaxed text-black/80">Това събитие вече е приключило.</p>
            </div>
          ) : null}
          {adminEditHref ? (
            <div className="mb-3 flex justify-end">
              <Link
                href={adminEditHref}
                className={cn(pub.btnSecondarySm, pub.focusRing)}
              >
                Редакция
              </Link>
            </div>
          ) : null}
          <FestivalHeroActionBar
            festivalId={String(festival.id)}
            icsHref={icsHref}
            reminderAnchorId={REMINDER_BLOCK_ID}
            onGuestReminderClick={() => setShowLogin(true)}
          />
        </div>
      </section>

      <FestivalQuickFactsStrip segments={quickFactSegments} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          {showDescriptionSection ? (
            <section className={cn(pub.sectionCard, "px-5 pb-5 pt-6")}>
              <h2 className={pub.sectionTitle}>Описание</h2>
              {descriptionText ? (
                <div className="mt-4">
                  <div
                    className={
                      !descriptionExpanded && descriptionNeedsToggle
                        ? "relative max-h-[min(16rem,60vh)] overflow-hidden"
                        : undefined
                    }
                  >
                    <p className="max-w-[74ch] whitespace-pre-line text-[15px] leading-relaxed text-black/80">{descriptionText}</p>
                    {!descriptionExpanded && descriptionNeedsToggle ? (
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/95 to-transparent"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  {descriptionNeedsToggle ? (
                    <button
                      type="button"
                      onClick={() => setDescriptionExpanded((v) => !v)}
                      className={cn(pub.btnGhost, "mt-3 px-3 py-1.5 text-sm")}
                      aria-expanded={descriptionExpanded}
                    >
                      {descriptionExpanded ? "Покажи по-малко" : "Виж повече"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-black/80">Няма описание за този фестивал.</p>
              )}
              {(tags.length > 0 || (showFreeBadge && !priceInQuickFactsStrip) || (showPriceRange && !showFreeBadge && !priceInQuickFactsStrip)) ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {showFreeBadge && !priceInQuickFactsStrip ? <Badge variant="primary">Безплатен вход</Badge> : null}
                  {showPriceRange && !showFreeBadge && !priceInQuickFactsStrip ? <Badge variant="neutral">{priceRange}</Badge> : null}
                  {visibleTags.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      #{tag}
                    </Badge>
                  ))}
                  {hiddenTagsCount > 0 ? <Badge variant="neutral">+{hiddenTagsCount}</Badge> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section
            id={FESTIVAL_PROGRAM_SECTION_ID}
            className={cn(
              "scroll-mt-24 rounded-2xl border border-amber-200/30 ring-1 ring-amber-100/15 transition-all duration-200 hover:-translate-y-px hover:shadow-md",
              hasProgramContent
                ? "bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]"
                : "bg-white/60 p-4 shadow-[0_1px_0_rgba(12,14,20,0.03),0_4px_14px_rgba(12,14,20,0.04)]",
            )}
          >
            <h2
              className={cn(
                "font-medium text-black/90",
                hasProgramContent ? "text-xl" : "text-lg text-black/90",
              )}
            >
              Програма
            </h2>
            {hasProgramContent ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-black/60">
                  Отделните часове добавяш към личния си план с бутона под всеки ред. Това е различно от напомнянето за целия фестивал — то се настройва от панела встрани.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {groupedDays.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setActiveDayId(day.id)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-150",
                        pub.focusRing,
                        displayedDay?.id === day.id ? pub.toggleActive : pub.toggleInactive,
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {(displayedDay?.items ?? []).length ? (
                    displayedDay?.items.map((item) => {
                      const itemId = String(item.id);
                      const isAdded = isScheduleItemInPlan(itemId);
                      return (
                        <article key={item.id}>
                          <div
                            className={cn(
                              "rounded-xl border p-4 transition-all duration-200",
                              isAdded
                                ? "border-[#7c2d12] bg-[#7c2d12]/5 shadow-sm"
                                : "border-black/10 hover:border-black/20",
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                {isAdded ? (
                                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#7c2d12]" aria-hidden />
                                ) : null}
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">
                                    {formatScheduleTimeRange(item.start_time, item.end_time) || "Час предстои"}
                                    {item.stage ? ` • ${item.stage}` : ""}
                                  </p>
                                  <h3 className="text-base font-medium text-black/90">{item.title}</h3>
                                  {item.description ? (
                                    <p className="text-sm leading-relaxed text-black/80">{item.description}</p>
                                  ) : null}
                                </div>
                              </div>
                              {isAdded ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void toggleScheduleItem(itemId);
                                  }}
                                  className={cn(
                                    "group shrink-0 text-sm font-medium text-[#7c2d12]",
                                    pub.focusRing,
                                  )}
                                >
                                  <span className="group-hover:hidden">{"\u2713"} В плана</span>
                                  <span className="hidden text-black/60 group-hover:inline">Премахни</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isAuthenticated) {
                                      setPendingItem(item);
                                      setShowLogin(true);
                                      return;
                                    }
                                    void toggleScheduleItem(itemId);
                                    show(`Добавено: ${item.title}`);
                                    setHighlightId(itemId);
                                  }}
                                  className={cn(
                                    "shrink-0 rounded-full border border-black/10 px-4 py-2 text-sm transition-all hover:bg-black/5 active:scale-95",
                                    pub.focusRing,
                                  )}
                                >
                                  + Добави в план
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="text-sm leading-relaxed text-black/60">Няма публикувани точки за избрания ден.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-6 text-center">
                <p className="text-sm font-medium leading-relaxed text-black/80">Няма публикувана програма за този фестивал.</p>
                {festival.website_url ? (
                  <p className="mt-3 text-sm leading-relaxed text-black/60">
                    <a
                      href={outboundClickHref({
                        targetUrl: festival.website_url,
                        festivalId: String(festival.id),
                        type: "website",
                        source: "festival_detail",
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#0c0e14] underline-offset-2 hover:underline"
                    >
                      Официален сайт
                    </a>
                    <span className="text-black/60"> — може да има актуална програма.</span>
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {showMediaSection ? <FestivalMedia items={mediaItems} /> : null}

          {relatedFestivals.length ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={pub.sectionTitle}>Още фестивали в {cityName || "региона"}</h2>
                <div className="flex flex-wrap gap-3 text-sm font-medium text-black/90">
                  {citySlug ? (
                    <Link
                      href={cityHref(citySlug)}
                      className="transition-all duration-150 hover:text-black hover:opacity-90 active:scale-[0.98]"
                    >
                      Страница на града
                    </Link>
                  ) : null}
                  {calendarMonth ? (
                    <Link
                      href={`/calendar/${calendarMonth}`}
                      className="transition-all duration-150 hover:text-black hover:opacity-90 active:scale-[0.98]"
                    >
                      Календар за месеца
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {relatedFestivals.slice(0, 4).map((item) => (
                  <Link key={item.slug} href={`/festivals/${item.slug}`} className="block">
                    <EventCard
                      title={item.title}
                      city={festivalCityLabel(item, "")}
                      category={item.category}
                      imageUrl={getFestivalHeroImage(item)}
                      startDate={primaryFestivalDate(item)}
                      endDate={item.end_date}
                      dateLine={formatFestivalDateLineLongBg(item)}
                      occurrenceDates={item.occurrence_dates}
                      startTime={item.start_time}
                      endTime={item.end_time}
                      isPromoted={hasActivePromotion(item)}
                      isVipOrganizer={hasActiveVip(item.organizer)}
                      festivalId={item.id}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <div className="space-y-4">
          <section id={REMINDER_BLOCK_ID} className={pub.railCard}>
            <div className="flex flex-col gap-1">
              <h2 className={pub.sectionTitleMd}>Напомняне</h2>
              <p className="text-xs leading-relaxed text-black/60">
                Настрой напомняне за началото на фестивала, после го добави в личния си план. Двете действия са отделни.
              </p>
            </div>

            <div className="mt-3">
              <FestivalRailActionBar
                festivalId={String(festival.id)}
                mapHref={mapHref}
                onGuestPlanClick={() => setShowLogin(true)}
              />
            </div>

            <div className="mt-4 border-t border-black/[0.06] pt-4">
              <div className="relative">
                <div className={cn(isGuest && "pointer-events-none opacity-50")}>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-black/60">
                    Кога да напомним
                    {isGuest ? (
                      <span className="text-xs font-normal normal-case text-black/40" aria-hidden>
                        {"\u{1F512}"}
                      </span>
                    ) : null}
                  </p>
                  <div className="space-y-1.5">
                    {reminderOptions.map((option) => {
                  const active = reminder === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (!isAuthenticated) return;
                        if (reminderPending || reminder === option.value) return;
                        setReminderPending(true);
                        setReminderFeedback(null);
                        void (async () => {
                          const result = await setFestivalReminder(String(festival.id), option.value);
                          if (!result.ok) {
                            setReminderFeedback({
                              kind: "error",
                              text: result.error ?? "Не успяхме да запазим. Опитай пак.",
                            });
                            setReminderPending(false);
                            return;
                          }
                          setReminderFeedback({
                            kind: "success",
                            text: reminderSuccessMessage(option.value),
                          });
                          if (reminderFeedbackTimerRef.current) {
                            window.clearTimeout(reminderFeedbackTimerRef.current);
                          }
                          reminderFeedbackTimerRef.current = window.setTimeout(() => {
                            setReminderFeedback(null);
                          }, 2800);
                          setReminderPending(false);
                        })();
                      }}
                      disabled={!isAuthenticated || reminderPending}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2 text-left transition-all duration-150 hover:border-black/15 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.99]",
                        pub.focusRing,
                        active ? pub.toggleActive : pub.toggleInactive,
                      )}
                      aria-pressed={active}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {active ? (
                          <span aria-hidden className="text-[13px] leading-none text-white/90">
                            ✔
                          </span>
                        ) : null}
                        {option.label}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          active ? (reminderPending ? "text-white/90" : "text-white/80") : "text-black/60"
                        }`}
                      >
                        {reminderPending && active ? "Запазваме..." : option.helper}
                      </span>
                    </button>
                  );
                })}
                  </div>
                </div>
                {isGuest ? (
                  <button
                    type="button"
                    className="absolute inset-0 z-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    aria-label="Вход, за да настроиш напомняния"
                    onClick={() => setShowLogin(true)}
                  />
                ) : null}
              </div>
              {reminderFeedback ? (
                <p
                  className={`mt-2 rounded-lg border px-2 py-1 text-xs font-semibold ${
                    reminderFeedback.kind === "success"
                      ? "border-emerald-200/70 bg-emerald-50/70 text-emerald-900/85"
                      : "border-red-200/70 bg-red-50/60 text-red-800"
                  }`}
                  role={reminderFeedback.kind === "error" ? "alert" : "status"}
                >
                  {reminderFeedback.text}
                </p>
              ) : null}
              {!isAuthenticated ? (
                <div className="mt-2">
                  <p className="text-sm text-black/60">
                    Влез, за да добавяш в план и да получаваш напомняния.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowLogin(true)}
                    className="mt-1 text-sm underline"
                  >
                    Вход
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-black/60">
                  Промените важат за напомнянето за целия фестивал, не за отделните часове в програмата.
                </p>
              )}
            </div>

            {festivalInPlan ? (
              <p className="mt-2 rounded-lg bg-emerald-50/70 px-2 py-1 text-xs font-semibold text-emerald-900/85">
                В плана ти е.
              </p>
            ) : null}
            {festivalPlanError ? <p className="mt-1 text-xs font-semibold text-red-800">{festivalPlanError}</p> : null}

            <div className="mt-4 border-t border-black/[0.06] pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Часове от програмата в плана</p>
              {selectedItems.length ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={clearPlan}
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60 transition-all duration-150 hover:text-black/75 active:scale-[0.98]"
                  >
                    Изчисти часовете
                  </button>
                </div>
              ) : null}
              <div className="mt-2 space-y-1.5">
                {selectedItems.length ? (
                  selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-xl border border-black/[0.06] bg-white/95 px-3 py-2 transition-all duration-200 hover:-translate-y-px hover:shadow-md",
                        highlightId === String(item.id) ? "bg-[#7c2d12]/10" : "",
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/60">
                        {formatScheduleTimeRange(item.start_time, item.end_time) || "Час предстои"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#0c0e14]">{item.title}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-black/10 bg-[#f5f3ec] px-4 py-4 text-sm leading-relaxed text-black/60">
                    Няма избрани часове. Добави ги от секцията „Програма“.
                  </div>
                )}
              </div>
            </div>
          </section>

          {showInfoSection ? (
            <section className={pub.railCardPlain}>
              <h2 className={pub.sectionTitleMd}>Информация</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {formattedDateRange ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Дата</dt>
                    <dd className="mt-1 leading-relaxed text-black/80">{formattedDateRange}</dd>
                  </div>
                ) : null}
                {locationSummary ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Локация</dt>
                    <dd className="mt-1 leading-relaxed text-black/80">{locationSummary}</dd>
                  </div>
                ) : null}
                {showOrganizer ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">
                      {displayOrganizers.length > 1 ? "Организатори" : "Организатор"}
                    </dt>
                    <dd className="mt-1 leading-relaxed text-black/80">
                      <ul className="list-none space-y-1 pl-0">
                        {displayOrganizers.map((row, index) => (
                          <li key={`${row.slug || row.name}-${index}`}>
                            {row.slug ? (
                              <Link
                                href={`/organizers/${row.slug}`}
                                className={cn(
                                  "underline decoration-black/30 underline-offset-2 transition hover:text-black",
                                  pub.focusRing,
                                )}
                              >
                                {row.name}
                              </Link>
                            ) : (
                              row.name
                            )}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
                {hasActiveVip(festival.organizer) ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Баджове</dt>
                    <dd className="mt-1 leading-relaxed text-black/80">VIP организатор</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <FestivalAppCta slug={festival.slug} />

          <div className="space-y-4 border-t border-black/[0.06] pt-4">
          {showMapSection ? (
            <section className={pub.railCardPlain}>
              <h2 className={pub.sectionTitleMd}>Карта</h2>
              <div className="mt-2 space-y-1 text-sm leading-relaxed text-black/80">
                {citySlug && cityName ? (
                  <Link
                    href={cityHref(citySlug)}
                    className="inline-block font-medium text-black/75 underline decoration-black/30 underline-offset-2 hover:text-black"
                  >
                    {cityName}
                  </Link>
                ) : cityName ? (
                  <p>{cityName}</p>
                ) : null}
                {mapLocationBlurb ? (
                  <p className={cityName ? "text-black/60" : "font-medium text-black/80"}>{mapLocationBlurb}</p>
                ) : null}
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-black/[0.08]">
                <iframe
                  title={`Карта: ${festival.title}`}
                  src={mapEmbedSrc ?? undefined}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-56 w-full border-0"
                />
              </div>
              {mapHref ? (
                <a
                  href={outboundClickHref({
                    targetUrl: mapHref,
                    festivalId: String(festival.id),
                    type: "maps",
                    source: "festival_detail",
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-black/90 underline decoration-black/25 underline-offset-2 transition-all duration-150 hover:decoration-black/40 hover:opacity-90 active:scale-[0.98]"
                >
                  Отвори в Google Maps
                </a>
              ) : null}
            </section>
          ) : null}

          {showTravelPopularLabel && (showNearbyBookingCard || accommodationOffers.length > 0) ? (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs font-semibold text-amber-950/90">
              🔥 Популярен за пътуване
            </p>
          ) : null}

          {showNearbyBookingCard && festival.start_date ? (
            <FestivalNearbyBookingCard
              place={nearbyBookingPlace}
              startDate={festival.start_date}
              endDate={festival.end_date}
              festivalId={String(festival.id)}
            />
          ) : null}

          {hasCtaButtons ? (
            <section className={pub.railCardPlain}>
              <h2 className={pub.sectionTitleMd}>Полезни връзки</h2>
              <div className="mt-4 flex flex-col gap-2">
                {festival.website_url ? (
                  <a
                    href={outboundClickHref({
                      targetUrl: festival.website_url,
                      festivalId: String(festival.id),
                      type: "website",
                      source: "festival_detail",
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "w-full rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-black/90 transition-all duration-150 hover:border-black/20 hover:bg-black/[0.04] active:scale-[0.98]",
                      pub.focusRing,
                    )}
                  >
                    Официален сайт
                  </a>
                ) : null}
                {festival.ticket_url ? (
                  <a
                    href={outboundClickHref({
                      targetUrl: festival.ticket_url,
                      festivalId: String(festival.id),
                      type: "ticket",
                      source: "festival_detail",
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-150 active:scale-[0.98]",
                      pub.focusRing,
                      showFreeBadge
                        ? "border-black/[0.08] bg-[#f8f7f3] text-black/60 hover:bg-[#f0ede6] hover:opacity-95"
                        : "border-black/[0.08] bg-white text-black/90 hover:border-black/20 hover:bg-black/[0.04]",
                    )}
                  >
                    Билети
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
            <FestivalAccommodationSection offers={accommodationOffers} festivalId={String(festival.id)} />
          </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
