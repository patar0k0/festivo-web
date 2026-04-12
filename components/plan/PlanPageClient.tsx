"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import { festivalProgrammeHref } from "@/lib/festival/programmeAnchor";
import type { FestivalDateFields } from "@/lib/festival/listingDates";
import { festivalEffectiveCalendarBounds, getFestivalTemporalState } from "@/lib/festival/temporal";
import type { PlanEntry, ReminderType } from "@/lib/plan/server";
import { cn } from "@/lib/utils";

type PlanPageClientProps = {
  entries: PlanEntry[];
  festivals: Array<{
    id: string;
    slug: string;
    title: string;
    city: string | null;
    start_date: string | null;
    end_date: string | null;
    hero_image: string | null;
    image_url: string | null;
  }>;
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

function formatTimeRange(start?: string | null, end?: string | null) {
  if (start && end) return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
  if (start) return start.slice(0, 5);
  return "Час предстои";
}

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

function getFestivalCardImage(festival: { hero_image: string | null; image_url: string | null }) {
  return festival.hero_image || festival.image_url || null;
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

  return (
    <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-black/5 sm:h-24 sm:w-24">
      {normalized && !loadError ? (
        <Image
          src={normalized}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 639px) 100vw, 96px"
          placeholder="blur"
          blurDataURL={PLAN_CARD_BLUR_DATA_URL}
          priority={Boolean(priority)}
          onError={() => setLoadError(true)}
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-black/[0.06] via-black/[0.05] to-black/[0.1]"
          aria-hidden
        />
      )}
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

export default function PlanPageClient({ entries, festivals, summary }: PlanPageClientProps) {
  const { isScheduleItemInPlan, isFestivalInPlan, setFestivalInPlan, toggleScheduleItem, reminderTypeByFestivalId, setFestivalReminder } = usePlanState();
  const [removingFestivalIds, setRemovingFestivalIds] = useState<Set<string>>(new Set());

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
    return Array.from(map.entries());
  }, [upcomingEntries]);

  const festivalEntries = useMemo(
    () => festivals.filter((festival) => isFestivalInPlan(festival.id)),
    [festivals, isFestivalInPlan]
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
              const isRemoving = removingFestivalIds.has(festival.id);
              const temporalBadge = getTemporalBadge(festival);
              const isNextUpcoming = summary.nextUpcomingFestival?.id === festival.id;
              const cardImage = getFestivalCardImage(festival);
              return (
                <article
                  key={festival.id}
                  className={cn(
                    "rounded-xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md",
                    isNextUpcoming ? "border-black/10 bg-[#fbf8f3]" : "border-black/5 bg-white"
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-black/5 px-3 py-1 text-xs text-black/60">
                          {festival.city ?? "България"}
                        </span>
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
                      </div>
                      <div className="text-sm text-black/60">{formatDateRange(festival.start_date, festival.end_date)}</div>
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <FestivalCardThumbnail
                        imageUrl={cardImage}
                        title={festival.title}
                        priority={festivalIndex === 0}
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <h3 className="text-xl font-medium tracking-tight text-black/90">{festival.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-snug text-black/60">
                          <span>{reminder === "none" ? "Без активно напомняне" : reminder === "24h" ? "Напомняне 24 часа преди началото" : "Напомняне в деня на събитието"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-4 border-t border-black/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/festivals/${festival.slug}`}
                          className="inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-all duration-200 hover:bg-black/90"
                        >
                          Детайли
                        </Link>
                        <Link
                          href={festivalProgrammeHref(`/festivals/${festival.slug}`)}
                          className="inline-flex rounded-full border border-black/10 bg-transparent px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-black transition-all duration-200 hover:bg-black/5"
                        >
                          Програма
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-black/60">Напомняне:</span>
                          <ReminderPills
                            value={reminder}
                            onChange={(next) => {
                              void setFestivalReminder(festival.id, next);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setRemovingFestivalIds((prev) => new Set(prev).add(festival.id));
                            try {
                              const response = await fetch("/api/plan/festivals", {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ festivalId: festival.id }),
                              });

                              if (!response.ok) return;
                              const payload = (await response.json()) as { inPlan?: boolean };
                              setFestivalInPlan(festival.id, Boolean(payload.inPlan));
                            } finally {
                              setRemovingFestivalIds((prev) => {
                                const next = new Set(prev);
                                next.delete(festival.id);
                                return next;
                              });
                            }
                          }}
                          disabled={isRemoving}
                          className="rounded-full px-4 py-2 text-sm font-medium text-red-600 underline-offset-2 transition-all duration-200 hover:text-red-700 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Премахни
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
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
                <p className="text-sm text-black/60">{first.city ?? "България"}</p>
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
                      {item.dayDate ?? "Дата"} • {formatTimeRange(item.startTime, item.endTime)}
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

