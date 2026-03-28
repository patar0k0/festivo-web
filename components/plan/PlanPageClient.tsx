"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import { festivalProgrammeHref } from "@/lib/festival/programmeAnchor";
import type { PlanEntry, ReminderType } from "@/lib/plan/server";

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

function parseDateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
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

/** Calendar YYYY-MM-DD in Europe/Sofia for a Date, or null. */
function dateToSofiaDateOnly(value: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

/** Normalize string | Date to YYYY-MM-DD (Sofia calendar for Date values). */
function startDateToDateOnly(startDate: string | Date): string | null {
  if (typeof startDate === "string") {
    const direct = parseDateOnly(startDate);
    if (direct) return direct;
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) return null;
    return dateToSofiaDateOnly(parsed);
  }
  return dateToSofiaDateOnly(startDate);
}

function getFestivalStatus(startDate: string | Date): "today" | "week" | "soon" | null {
  const start = startDateToDateOnly(startDate);
  if (!start) return null;

  const today = getSofiaTodayDateString();
  if (!today) return null;

  const diffDays = Math.floor((dateOnlyToUtcMs(start) - dateOnlyToUtcMs(today)) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "soon";
}

const FESTIVAL_STATUS_LABEL: Record<"today" | "week" | "soon", string> = {
  today: "Днес",
  week: "Тази седмица",
  soon: "Скоро",
};

function getFestivalCardImage(festival: { hero_image: string | null; image_url: string | null }) {
  return festival.hero_image || festival.image_url || null;
}

function FestivalCardThumbnail({ imageUrl, title }: { imageUrl: string; title: string }) {
  return (
    <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-black/5 sm:h-24 sm:w-24">
      <img src={imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
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
    <div className="inline-flex items-center gap-0.5">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              active ? "bg-black text-white" : "text-black/60 hover:text-black"
            }`}
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
  const hasUpcomingFestivals = useMemo(() => {
    const today = getSofiaTodayDateString();
    if (!today) return false;
    return festivalEntries.some((festival) => {
      const start = parseDateOnly(festival.start_date);
      const end = parseDateOnly(festival.end_date ?? festival.start_date);
      if (!start && !end) return false;
      const compareDate = end ?? start;
      if (!compareDate) return false;
      return compareDate >= today;
    });
  }, [festivalEntries]);

  if (!upcomingEntries.length && !festivalEntries.length) {
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_14px_28px_rgba(12,14,20,0.09)] md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Личен дашборд</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0c0e14]">Моят план</h1>
          <p className="mt-2 text-sm leading-relaxed text-black/60">Събирай любими фестивали, следи напомнянията и управлявай програмата си на едно място.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/[0.08] bg-[#f7f6f2] p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">Запазени фестивали</p>
              <p className="mt-1 text-4xl font-black leading-none text-[#0c0e14]">{summary.savedFestivalCount}</p>
            </div>
            <div className="rounded-xl border border-black/[0.08] bg-[#f7f6f2] p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">Активни напомняния</p>
              <p className="mt-1 text-4xl font-black leading-none text-[#0c0e14]">{summary.activeReminderCount}</p>
            </div>
            <div className={`rounded-xl border p-4 ${summary.nextUpcomingFestival ? "border-black/[0.08] bg-[#f7f6f2]" : "border-black/[0.06] bg-black/[0.02]"}`}>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">Следващ фестивал</p>
              {summary.nextUpcomingFestival ? (
                <>
                  <p className="mt-1 text-base font-bold leading-snug text-[#0c0e14]">{summary.nextUpcomingFestival.title}</p>
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

        <div className="rounded-3xl border border-black/[0.08] bg-gradient-to-b from-white via-white to-[#f7f6f2] px-6 py-14 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_22px_40px_rgba(12,14,20,0.08)] md:px-10 md:py-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-black/[0.08] bg-white shadow-[0_8px_20px_rgba(12,14,20,0.08)]" aria-hidden>
            <span className="text-2xl">✦</span>
          </div>
          <p className="mt-5 text-2xl font-semibold tracking-tight text-[#0c0e14]">Все още нямаш запазени фестивали</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-black/55 md:text-[15px]">
            Разгледай фестивалите и запази тези, които искаш да посетиш.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/festivals"
              className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-[0_10px_24px_rgba(12,14,20,0.24)]"
            >
              Разгледай фестивали
            </Link>
            <Link
              href="/map"
              className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c0e14] transition hover:bg-black/[0.03]"
            >
              Отвори карта
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_14px_28px_rgba(12,14,20,0.09)] md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Личен дашборд</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0c0e14]">Моят план</h1>
        <p className="mt-2 text-sm leading-relaxed text-black/60">Всички запазени фестивали, активни напомняния и избрани моменти от програмата ти.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-black/[0.08] bg-[#f7f6f2] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">Запазени фестивали</p>
            <p className="mt-1 text-4xl font-black leading-none text-[#0c0e14]">{summary.savedFestivalCount}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-[#f7f6f2] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">Активни напомняния</p>
            <p className="mt-1 text-4xl font-black leading-none text-[#0c0e14]">{summary.activeReminderCount}</p>
          </div>
          <div className={`rounded-xl border p-4 ${summary.nextUpcomingFestival ? "border-black/[0.08] bg-[#f7f6f2]" : "border-black/[0.06] bg-black/[0.02]"}`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">Следващ фестивал</p>
            {summary.nextUpcomingFestival ? (
              <>
                <p className="mt-1 text-base font-bold leading-snug text-[#0c0e14]">{summary.nextUpcomingFestival.title}</p>
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

      {festivalEntries.length ? (
        <section className="rounded-2xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_14px_28px_rgba(12,14,20,0.09)] md:p-6">
          <h2 className="text-xl font-bold tracking-tight text-[#0c0e14]">{hasUpcomingFestivals ? "Предстоящи" : "Запазени фестивали"}</h2>
          <p className="mt-1 text-sm text-black/55">Следиш цялото събитие; напомнянията са към фестивала.</p>
          <div className="mt-4 space-y-3">
            {festivalEntries.map((festival) => {
              const reminder = reminderTypeByFestivalId[festival.id] ?? "none";
              const isRemoving = removingFestivalIds.has(festival.id);
              const statusKey = festival.start_date ? getFestivalStatus(festival.start_date) : null;
              const statusLabel = statusKey ? FESTIVAL_STATUS_LABEL[statusKey] : null;
              const cardImage = getFestivalCardImage(festival);
              return (
                <article
                  key={festival.id}
                  className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] sm:p-6"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-black/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-black/60">
                          {festival.city ?? "България"}
                        </span>
                        {statusLabel ? (
                          <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-medium text-black/70">
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm font-medium text-black/60">{formatDateRange(festival.start_date, festival.end_date)}</div>
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {cardImage ? <FestivalCardThumbnail imageUrl={cardImage} title={festival.title} /> : null}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <h3 className="text-xl font-semibold tracking-tight text-black">{festival.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/60">
                          <span>{reminder === "none" ? "Без активно напомняне" : reminder === "24h" ? "Напомняне 24 часа преди началото" : "Напомняне в деня на събитието"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-black/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/festivals/${festival.slug}`}
                          className="inline-flex rounded-full bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                        >
                          Детайли
                        </Link>
                        <Link
                          href={festivalProgrammeHref(`/festivals/${festival.slug}`)}
                          className="inline-flex rounded-full border border-black/[0.14] bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:border-black/25 hover:bg-black/[0.02]"
                        >
                          Програма
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-black/50">Напомняне:</span>
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
                          className="text-sm font-medium text-red-600/60 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Премахни
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {groupedByFestival.map(([festivalId, items]) => {
        const first = items[0];
        const reminder = reminderTypeByFestivalId[festivalId] ?? "none";
        return (
          <section
            key={festivalId}
            className="rounded-2xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_14px_28px_rgba(12,14,20,0.09)] md:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">Програма</p>
                <h2 className="text-xl font-bold tracking-tight text-[#0c0e14]">{first.festivalTitle}</h2>
                <p className="text-sm text-black/60">{first.city ?? "България"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ReminderPills
                  value={reminder}
                  onChange={(next) => {
                    void setFestivalReminder(festivalId, next);
                  }}
                />
                <Link href={`/festivals/${first.festivalSlug}`} className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
                  Детайли
                </Link>
                <Link
                  href={festivalProgrammeHref(`/festivals/${first.festivalSlug}`)}
                  className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]"
                >
                  Програма
                </Link>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div key={item.scheduleItemId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white px-3 py-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
                      {item.dayDate ?? "Дата"} • {formatTimeRange(item.startTime, item.endTime)}
                    </p>
                    <p className="text-sm font-semibold text-[#0c0e14]">{item.title}</p>
                    {item.stage ? <p className="text-xs text-black/55">{item.stage}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleScheduleItem(item.scheduleItemId);
                    }}
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]"
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

