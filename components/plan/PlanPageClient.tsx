"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import type { PlanEntry, ReminderType } from "@/lib/plan/server";

type PlanPageClientProps = {
  entries: PlanEntry[];
};

function formatTimeRange(start?: string | null, end?: string | null) {
  if (start && end) return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
  if (start) return start.slice(0, 5);
  return "Час предстои";
}

export default function PlanPageClient({ entries }: PlanPageClientProps) {
  const { isScheduleItemInPlan, toggleScheduleItem, reminderTypeByFestivalId, setFestivalReminder } = usePlanState();

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

  if (!upcomingEntries.length) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <p className="text-base font-semibold text-[#0c0e14]">Нямаш нищо в плана.</p>
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
                <Link href={`/festival/${first.festivalSlug}`} className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
                  Детайли
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
                    Премахни
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
