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
  }>;
};

function formatTimeRange(start?: string | null, end?: string | null) {
  if (start && end) return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
  if (start) return start.slice(0, 5);
  return "Час предстои";
}

export default function PlanPageClient({ entries, festivals }: PlanPageClientProps) {
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

  if (!upcomingEntries.length && !festivalEntries.length) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <p className="text-base font-semibold text-[#0c0e14]">Нямаш нищо в плана.</p>
        <p className="mt-2 text-sm text-black/55">
          Запази фестивал от списъка или картата с „Запази“, а отделни часове — от страницата на фестивала в секция „Програма“.
        </p>
        <Link
          href="/festivals"
          className="mt-4 inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white"
        >
          Към фестивали
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {festivalEntries.length ? (
        <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h2 className="text-xl font-bold tracking-tight text-[#0c0e14]">Запазени фестивали</h2>
          <p className="mt-1 text-sm text-black/55">Следиш цялото събитие; напомнянията са към фестивала.</p>
          <div className="mt-4 space-y-2">
            {festivalEntries.map((festival) => {
              const reminder = reminderTypeByFestivalId[festival.id] ?? "none";
              const isRemoving = removingFestivalIds.has(festival.id);
              return (
                <div key={festival.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white px-3 py-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
                      {festival.city ?? "България"}
                    </p>
                    <p className="text-sm font-semibold text-[#0c0e14]">{festival.title}</p>
                    <p className="text-xs text-black/55">
                      {festival.start_date ?? "Дата предстои"}
                      {festival.end_date && festival.end_date !== festival.start_date ? ` - ${festival.end_date}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Премахни от запазените
                    </button>
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                      Напомняне
                      <select
                        value={reminder}
                        onChange={(event) => {
                          void setFestivalReminder(festival.id, event.target.value as ReminderType);
                        }}
                        className="ml-2 rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-xs"
                      >
                        <option value="none">Без</option>
                        <option value="24h">24h</option>
                        <option value="same_day_09">09:00</option>
                      </select>
                    </label>
                    <Link href={`/festivals/${festival.slug}`} className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
                      Детайли
                    </Link>
                    <Link
                      href={festivalProgrammeHref(`/festivals/${festival.slug}`)}
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]"
                    >
                      Програма
                    </Link>
                  </div>
                </div>
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
            className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">Програма</p>
                <h2 className="text-xl font-bold tracking-tight text-[#0c0e14]">{first.festivalTitle}</h2>
                <p className="text-sm text-black/60">{first.city ?? "България"}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                  Напомняне
                  <select
                    value={reminder}
                    onChange={(event) => {
                      void setFestivalReminder(festivalId, event.target.value as ReminderType);
                    }}
                    className="ml-2 rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-xs"
                  >
                    <option value="none">Без</option>
                    <option value="24h">24h</option>
                    <option value="same_day_09">09:00</option>
                  </select>
                </label>
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

