"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import { festivalProgrammeHref } from "@/lib/festival/programmeAnchor";
import type { FestivalDateFields } from "@/lib/festival/listingDates";
import { festivalEffectiveCalendarBounds, getFestivalTemporalState } from "@/lib/festival/temporal";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import type { PlanEntry, ReminderType } from "@/lib/plan/server";
import { formatScheduleTimeRange } from "@/lib/festival/festivalTimeFields";
import { cn } from "@/lib/utils";
import type { Festival, FestivalMediaItem } from "@/lib/types";

type PlanPageFestivalRow = FestivalDateFields & {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  hero_image: string | null;
  image_url: string | null;
  festival_media: Array<Pick<FestivalMediaItem, "url" | "type" | "sort_order" | "is_hero">> | null;
};

type PlanPageClientProps = {
  entries: PlanEntry[];
  festivals: PlanPageFestivalRow[];
  pastFestivals: PlanPageFestivalRow[];
  summary: {
    savedFestivalCount: number;
    activeReminderCount: number;
    nextUpcomingFestival: {
      id: string;
      title: string;
      startDate: string | null;
      endDate: string | null;
    } | null;
  };
};

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate) return "Дата предстои";

  const formatter = new Intl.DateTimeFormat("bg-BG", {
    day: "numeric",
    month: "long",
  });
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return startDate;
  if (!endDate || endDate === startDate) return formatter.format(start);

  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(end.getTime())) return formatter.format(start);
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getSofiaTodayDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function dateOnlyToUtcMs(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function calendarDaysFromTodayToStart(festival: FestivalDateFields): number | null {
  const bounds = festivalEffectiveCalendarBounds(festival);
  if (!bounds) return null;
  const today = getSofiaTodayDateString();
  if (!today) return null;
  return Math.floor((dateOnlyToUtcMs(bounds.startYmd) - dateOnlyToUtcMs(today)) / (1000 * 60 * 60 * 24));
}

function getTemporalBadge(
  festival: FestivalDateFields
): { label: string; className: string } | null {
  const state = getFestivalTemporalState(festival);
  if (state === "ongoing") {
    return { label: "В момента", className: "bg-emerald-100 text-emerald-700" };
  }
  if (state === "upcoming") {
    const delta = calendarDaysFromTodayToStart(festival);
    if (delta != null && delta >= 0 && delta <= 7) {
      return { label: "Скоро", className: "bg-amber-100 text-amber-700" };
    }
  }
  return null;
}

/** Resolves display image: optional future `cover_image_url`, then canonical hero / `image_url` / gallery. */
function resolvePlanFestivalCardImageUrl(festival: PlanPageFestivalRow): string | null {
  const row = festival as PlanPageFestivalRow & { cover_image_url?: string | null; media?: Array<{ url?: string | null }> | null };
  const cover = typeof row.cover_image_url === "string" ? row.cover_image_url.trim() : "";
  if (cover) return normalizePlanImageSrc(cover);
  const legacyMedia = row.media?.[0]?.url;
  if (typeof legacyMedia === "string" && legacyMedia.trim()) return normalizePlanImageSrc(legacyMedia.trim());
  return getFestivalHeroImage(festival as Festival);
}

/** Tiny neutral JPEG for `placeholder="blur"` on remote URLs (no build-time blurDataURL). */
const PLAN_CARD_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAAAAQQREjH/2gAMAwEAAhEDEQA/ANbKf/9k=";

function normalizePlanImageSrc(src?: string | null): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return null;
}

function FestivalCardThumbnail({
  imageUrl,
  title,
  priority,
}: {
  imageUrl: string | null;
  title: string;
  priority?: boolean;
}) {
  const normalized = useMemo(() => normalizePlanImageSrc(imageUrl), [imageUrl]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [normalized]);

  if (!normalized || loadError) {
    return <div className="h-24 w-24 shrink-0 rounded-xl bg-black/5 sm:h-28 sm:w-28" aria-hidden />;
  }

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black/5 sm:h-28 sm:w-28">
      <Image
        src={normalized}
        alt={title}
        fill
        className="object-cover"
        sizes="112px"
        placeholder="blur"
        blurDataURL={PLAN_CARD_BLUR_DATA_URL}
        priority={Boolean(priority)}
        onError={() => setLoadError(true)}
      />
    </div>
  );
}

function ReminderMenu({
  value,
  onChange,
}: {
  value: ReminderType;
  onChange: (next: ReminderType) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const summary =
    value === "24h"
      ? "24ч"
      : value === "same_day_09"
        ? "В деня (09:00)"
        : "Без";

  const options: Array<{ value: ReminderType; label: string }> = [
    { value: "24h", label: "1 ден по-рано" },
    { value: "same_day_09", label: "В деня (09:00)" },
    { value: "none", label: "Без напомняне" },
  ];

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-black/80 transition hover:bg-black/5"
      >
        Напомняне: {summary}
        <span className="text-black/40" aria-hidden>
          ▼
        </span>
      </button>
      {open ? (
        <div
          className="absolute left-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"
          role="menu"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full px-3 py-2 text-left text-sm transition hover:bg-black/[0.04]",
                value === opt.value ? "bg-[#7c2d12]/10 font-medium text-[#7c2d12]" : "text-black/80"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReminderPills({
  value,
  onChange,
}: {
  value: ReminderType;
  onChange: (next: ReminderType) => void;
}) {
  const options: Array<{ value: ReminderType; label: string }> = [
    { value: "24h", label: "24ч" },
    { value: "same_day_09", label: "В деня" },
    { value: "none", label: "Без" },
  ];

  return (
        <div className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.04] p-1">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold transition-all duration-200",
              active && option.value === "same_day_09"
                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50/90"
                : active
                  ? "bg-black text-white hover:bg-black/90"
                  : "text-black/60 hover:bg-black/5 hover:text-black"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SavedFestivalPlanCard({
  festival,
  festivalIndex,
  isPast,
  reminder,
  planToggleBusy,
  isNextUpcoming,
  temporalBadge,
  inPlan,
  onReminderChange,
  onTogglePlan,
}: {
  festival: PlanPageFestivalRow;
  festivalIndex: number;
  isPast: boolean;
  reminder: ReminderType;
  planToggleBusy: boolean;
  isNextUpcoming: boolean;
  temporalBadge: { label: string; className: string } | null;
  inPlan: boolean;
  onReminderChange: (next: ReminderType) => void;
  onTogglePlan: () => void | Promise<void>;
}) {
  const router = useRouter();
  const cardImage = resolvePlanFestivalCardImageUrl(festival);

  const subtitleParts = [
    formatDateRange(festival.start_date ?? null, festival.end_date ?? null),
    festival.city?.trim(),
  ].filter(Boolean) as string[];

  return (
    <article
      onClick={() => {
        router.push(`/festivals/${festival.slug}`);
      }}
      className={cn(
        "cursor-pointer rounded-2xl border border-black/10 p-4 transition hover:bg-black/[0.02]",
        isPast
          ? "bg-white opacity-60"
          : isNextUpcoming
            ? "bg-[#fbf8f3]"
            : "bg-white"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-row gap-3">
          <FestivalCardThumbnail
            imageUrl={cardImage}
            title={festival.title}
            priority={!isPast && festivalIndex === 0}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {isPast ? (
                <span className="text-xs text-black/50">Приключил</span>
              ) : (
                <>
                  {temporalBadge ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        temporalBadge.className
                      )}
                    >
                      {temporalBadge.label}
                    </span>
                  ) : null}
                  {isNextUpcoming ? <span className="text-xs text-black/50">Следващ</span> : null}
                </>
              )}
            </div>
            <h3 className="mt-1 line-clamp-2 text-lg font-semibold tracking-tight text-black/90">{festival.title}</h3>
            <p className="mt-0.5 text-sm leading-snug text-black/60">{subtitleParts.join(" · ")}</p>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ReminderMenu value={reminder} onChange={onReminderChange} />
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/festivals/${festival.slug}`);
            }}
            className="inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/90 transition hover:bg-black/5"
          >
            Виж фестивала
          </button>
          {inPlan ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onTogglePlan();
              }}
              disabled={planToggleBusy}
              className="inline-flex rounded-full border border-black/10 bg-[#7c2d12]/10 px-4 py-2 text-sm font-semibold text-[#7c2d12] transition hover:bg-[#7c2d12]/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              ✓ В плана
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onTogglePlan();
              }}
              disabled={planToggleBusy}
              className="inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/90 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              + Добави
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PlanPageClient({ entries, festivals, pastFestivals, summary }: PlanPageClientProps) {
  const {
    isScheduleItemInPlan,
    isFestivalInPlan,
    toggleScheduleItem,
    reminderTypeByFestivalId,
    setFestivalReminder,
    toggleFestivalPlan,
  } = usePlanState();
  const [planToggleBusyIds, setPlanToggleBusyIds] = useState<Set<string>>(new Set());
  const [isPastExpanded, setIsPastExpanded] = useState(false);

  const runFestivalPlanToggle = async (festivalId: string) => {
    setPlanToggleBusyIds((prev) => new Set(prev).add(festivalId));
    try {
      await toggleFestivalPlan(festivalId);
    } finally {
      setPlanToggleBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(festivalId);
        return next;
      });
    }
  };

  const upcomingEntries = useMemo(
    () => entries.filter((entry) => isScheduleItemInPlan(entry.scheduleItemId)),
    [entries, isScheduleItemInPlan]
  );

  const groupedByFestival = useMemo(() => {
    const map = new Map<string, PlanEntry[]>();
    upcomingEntries.forEach((entry) => {
      const key = entry.festivalId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(entry);
    });
    return Array.from(map.entries()).map(([fid, list]) => [
      fid,
      [...list].sort((a, b) => {
        const dc = (a.dayDate ?? "").localeCompare(b.dayDate ?? "");
        if (dc !== 0) return dc;
        const tc = (a.startTime ?? "").localeCompare(b.startTime ?? "");
        if (tc !== 0) return tc;
        return a.title.localeCompare(b.title);
      }),
    ]) as [string, PlanEntry[]][];
  }, [upcomingEntries]);

  const festivalEntries = useMemo(
    () => festivals.filter((festival) => isFestivalInPlan(festival.id)),
    [festivals, isFestivalInPlan]
  );
  const pastFestivalEntries = useMemo(
    () => pastFestivals.filter((festival) => isFestivalInPlan(festival.id)),
    [pastFestivals, isFestivalInPlan]
  );
  const hasUpcomingFestivals = festivalEntries.length > 0;

  if (!upcomingEntries.length && summary.savedFestivalCount === 0) {
    return (
      <div className="space-y-8">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Личен дашборд</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-black/90">Моят план</h1>
          <p className="mt-2 text-sm leading-relaxed text-black/70">Събирай любими фестивали, следи напомнянията и управлявай програмата си на едно място.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
              <p className="text-xs uppercase tracking-wide text-black/50">Запазени фестивали</p>
              <p className="mt-1 text-3xl font-semibold text-black/90">{summary.savedFestivalCount}</p>
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
              <p className="text-xs uppercase tracking-wide text-black/50">Активни напомняния</p>
              <p className="mt-1 text-3xl font-semibold text-black/90">{summary.activeReminderCount}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-[#fbf8f3] p-5 shadow-sm transition-all duration-200 hover:shadow-md">
              <p className="text-xs uppercase tracking-wide text-black/50">Следващ фестивал</p>
              {summary.nextUpcomingFestival ? (
                <>
                  <p className="mt-1 text-base font-semibold leading-snug text-black/90">{summary.nextUpcomingFestival.title}</p>
                  <p className="mt-0.5 text-sm font-medium text-black/60">
                    {formatDateRange(summary.nextUpcomingFestival.startDate, summary.nextUpcomingFestival.endDate)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm font-medium leading-snug text-black/45">Няма предстоящо събитие</p>
              )}
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-black/5 bg-white px-6 py-14 text-center shadow-sm transition-all duration-200 hover:shadow-md md:px-10 md:py-16">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border-subtle bg-surface shadow-card"
            aria-hidden
          >
            <span className="text-2xl">✦</span>
          </div>
          <p className="mt-5 text-2xl font-semibold tracking-tight text-black">Все още нямаш запазени фестивали</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-black/55 md:text-[15px]">
            Разгледай фестивалите и запази тези, които искаш да посетиш.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/festivals"
              className="inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.15em] text-white transition-all duration-200 hover:bg-black/90"
            >
              Разгледай фестивали
            </Link>
            <Link
              href="/map"
              className="inline-flex rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.15em] text-black transition-all duration-200 hover:bg-black/5"
            >
              Отвори карта
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Личен дашборд</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-black/90">Моят план</h1>
        <p className="mt-2 text-sm leading-relaxed text-black/70">Всички запазени фестивали, активни напомняния и избрани моменти от програмата ти.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <p className="text-xs uppercase tracking-wide text-black/50">Запазени фестивали</p>
            <p className="mt-1 text-3xl font-semibold text-black/90">{summary.savedFestivalCount}</p>
          </div>
          <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <p className="text-xs uppercase tracking-wide text-black/50">Активни напомняния</p>
            <p className="mt-1 text-3xl font-semibold text-black/90">{summary.activeReminderCount}</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-[#fbf8f3] p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <p className="text-xs uppercase tracking-wide text-black/50">Следващ фестивал</p>
            {summary.nextUpcomingFestival ? (
              <>
                <p className="mt-1 text-base font-semibold leading-snug text-black/90">{summary.nextUpcomingFestival.title}</p>
                <p className="mt-0.5 text-sm font-medium text-black/60">
                  {formatDateRange(summary.nextUpcomingFestival.startDate, summary.nextUpcomingFestival.endDate)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm font-medium leading-snug text-black/45">Няма предстоящо събитие</p>
            )}
          </div>
        </div>
      </section>

      {summary.savedFestivalCount > 0 ? (
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 md:p-6">
          <h2 className="text-xl font-bold tracking-tight text-black/90">{hasUpcomingFestivals ? "Предстоящи" : "Запазени фестивали"}</h2>
          <p className="mt-1 text-sm text-black/60">Следиш цялото събитие; напомнянията са към фестивала.</p>
          <div className="mt-4 space-y-3">
            {festivalEntries.length ? (
            festivalEntries.map((festival, festivalIndex) => {
              const reminder = reminderTypeByFestivalId[festival.id] ?? "none";
              const planToggleBusy = planToggleBusyIds.has(festival.id);
              const temporalBadge = getTemporalBadge(festival);
              const isNextUpcoming = summary.nextUpcomingFestival?.id === festival.id;
              return (
                <SavedFestivalPlanCard
                  key={festival.id}
                  festival={festival}
                  festivalIndex={festivalIndex}
                  isPast={false}
                  reminder={reminder}
                  planToggleBusy={planToggleBusy}
                  isNextUpcoming={isNextUpcoming}
                  temporalBadge={temporalBadge}
                  inPlan={isFestivalInPlan(festival.id)}
                  onReminderChange={(next) => {
                    void setFestivalReminder(festival.id, next);
                  }}
                  onTogglePlan={() => runFestivalPlanToggle(festival.id)}
                />
              );
            })
            ) : (
              <div className="text-center text-sm leading-relaxed text-black/60">
                <p>Нямаш предстоящи фестивали.</p>
                <p className="mt-1">Разгледай и запази нови.</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {pastFestivalEntries.length > 0 ? (
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 md:p-6">
          <h2 className="text-xl font-bold tracking-tight">
            <button
              type="button"
              onClick={() => setIsPastExpanded((v) => !v)}
              aria-expanded={isPastExpanded}
              className={cn(
                "w-full text-left transition-all duration-200",
                isPastExpanded ? "text-black/90" : "text-black/70"
              )}
            >
              Минали фестивали ({pastFestivals.length}) — {isPastExpanded ? "Скрий" : "Покажи"}
            </button>
          </h2>
          {isPastExpanded ? (
            <div className="transition-all duration-200">
              <p className="mt-1 text-sm text-black/60">Фестивали, които вече са приключили.</p>
              <div className="mt-4 space-y-3">
                {pastFestivalEntries.map((festival, festivalIndex) => {
                  const reminder = reminderTypeByFestivalId[festival.id] ?? "none";
                  const planToggleBusy = planToggleBusyIds.has(festival.id);
                  return (
                    <SavedFestivalPlanCard
                      key={festival.id}
                      festival={festival}
                      festivalIndex={festivalIndex}
                      isPast
                      reminder={reminder}
                      planToggleBusy={planToggleBusy}
                      isNextUpcoming={false}
                      temporalBadge={null}
                      inPlan={isFestivalInPlan(festival.id)}
                      onReminderChange={(next) => {
                        void setFestivalReminder(festival.id, next);
                      }}
                      onTogglePlan={() => runFestivalPlanToggle(festival.id)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {groupedByFestival.map(([festivalId, items]) => {
        const first = items[0];
        const reminder = reminderTypeByFestivalId[festivalId] ?? "none";
        return (
          <section
            key={festivalId}
            className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 md:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Програма</p>
                <h2 className="text-xl font-bold tracking-tight text-black/90">{first.festivalTitle}</h2>
                {first.city?.trim() ? <p className="text-sm text-black/60">{first.city}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ReminderPills
                  value={reminder}
                  onChange={(next) => {
                    void setFestivalReminder(festivalId, next);
                  }}
                />
                <Link
                  href={`/festivals/${first.festivalSlug}`}
                  className="inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-all duration-200 hover:bg-black/90"
                >
                  Детайли
                </Link>
                <Link
                  href={festivalProgrammeHref(`/festivals/${first.festivalSlug}`)}
                  className="inline-flex rounded-full border border-black/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-black transition-all duration-200 hover:bg-black/5"
                >
                  Програма
                </Link>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div
                  key={item.scheduleItemId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
                      {item.dayDate ?? "Дата"} • {formatScheduleTimeRange(item.startTime, item.endTime) || "Час предстои"}
                    </p>
                    <p className="text-sm font-medium text-black/90">{item.title}</p>
                    {item.stage ? <p className="text-[13px] text-black/60">{item.stage}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleScheduleItem(item.scheduleItemId);
                    }}
                    className="rounded-full px-4 py-2 text-sm font-medium text-red-600 underline-offset-2 transition-all duration-200 hover:text-red-700 hover:opacity-80"
                  >
                    Премахни от програмата
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

