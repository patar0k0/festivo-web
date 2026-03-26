"use client";

import { useCallback, useState } from "react";
import type { ReminderType } from "@/lib/plan/server";
import { usePlanState } from "@/components/plan/PlanStateProvider";

type HeroProps = {
  festivalId: string;
  icsHref: string;
  reminderAnchorId: string;
};

/**
 * Hero / top zone: single primary CTA (reminder) + calendar as secondary.
 */
export function FestivalHeroActionBar({ festivalId, icsHref, reminderAnchorId }: HeroProps) {
  const { isAuthenticated, requireAuthForPlan, reminderTypeByFestivalId, setFestivalReminder } = usePlanState();

  const reminder = reminderTypeByFestivalId[festivalId] ?? "none";

  const scrollToReminder = useCallback(() => {
    const el = document.getElementById(reminderAnchorId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reminderAnchorId]);

  const onReminderPrimary = useCallback(async () => {
    if (!isAuthenticated) {
      requireAuthForPlan();
      return;
    }
    if (reminder === "none") {
      await setFestivalReminder(festivalId, "24h" as ReminderType);
    }
    scrollToReminder();
  }, [festivalId, isAuthenticated, reminder, requireAuthForPlan, scrollToReminder, setFestivalReminder]);

  const primaryClass =
    "inline-flex min-h-[56px] w-full flex-[1.2] items-center justify-center gap-2 rounded-xl bg-[#ff4c1f] px-4 py-3 text-center text-[15px] font-semibold text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition hover:bg-[#e6441a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/40 sm:min-w-[12rem]";
  const secondaryClass =
    "inline-flex min-h-[44px] w-full flex-1 items-center justify-center gap-2 rounded-xl border border-black/[0.12] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#0c0e14] transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 sm:min-w-[10rem]";

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <button type="button" onClick={() => void onReminderPrimary()} className={primaryClass}>
          {reminder === "none" ? "Напомни ми" : "Напомняне настроено"}
        </button>
        <a href={icsHref} className={secondaryClass}>
          Добави в календара
        </a>
      </div>
      <p className="text-xs text-black/55">Ще ти напомним за началото на събитието</p>
    </div>
  );
}

type RailProps = {
  festivalId: string;
  mapHref: string | null;
};

/**
 * Rail: planning + navigation only (reminder timing lives in the same aside card below).
 */
export function FestivalRailActionBar({ festivalId, mapHref }: RailProps) {
  const { isAuthenticated, requireAuthForPlan, toggleFestivalPlan, festivalIds } = usePlanState();
  const [planBusy, setPlanBusy] = useState(false);

  const festivalInPlan = festivalIds.includes(festivalId);

  const onPlan = useCallback(async () => {
    if (!isAuthenticated) {
      requireAuthForPlan();
      return;
    }
    setPlanBusy(true);
    try {
      await toggleFestivalPlan(festivalId);
    } finally {
      setPlanBusy(false);
    }
  }, [festivalId, isAuthenticated, requireAuthForPlan, toggleFestivalPlan]);

  const btnClass =
    "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[#0c0e14] transition hover:border-black/18 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 disabled:opacity-50";
  const navClass =
    "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[#0c0e14] transition hover:border-black/18 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25";

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void onPlan()} disabled={planBusy} className={btnClass}>
        {festivalInPlan ? "Премахни от моя план" : "Добави в моя план"}
      </button>
      {mapHref ? (
        <a href={mapHref} target="_blank" rel="noreferrer" className={navClass}>
          Навигация
        </a>
      ) : null}
    </div>
  );
}
