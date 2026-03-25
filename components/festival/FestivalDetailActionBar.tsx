"use client";

import { useCallback, useState } from "react";
import type { ReminderType } from "@/lib/plan/server";
import { usePlanState } from "@/components/plan/PlanStateProvider";

type Props = {
  festivalId: string;
  mapHref: string | null;
  icsHref: string;
  reminderAnchorId: string;
};

export default function FestivalDetailActionBar({ festivalId, mapHref, icsHref, reminderAnchorId }: Props) {
  const {
    isAuthenticated,
    requireAuthForPlan,
    toggleFestivalPlan,
    reminderTypeByFestivalId,
    setFestivalReminder,
    festivalIds,
  } = usePlanState();
  const [planBusy, setPlanBusy] = useState(false);

  const reminder = reminderTypeByFestivalId[festivalId] ?? "none";
  const festivalInPlan = festivalIds.includes(festivalId);

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

  const btnBase =
    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/35 sm:flex-initial sm:min-w-[9.5rem]";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
      <button type="button" onClick={() => void onReminderPrimary()} className={`${btnBase} bg-[#ff4c1f] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] hover:bg-[#e6441a]`}>
        Напомни ми
      </button>
      <button
        type="button"
        onClick={() => void onPlan()}
        disabled={planBusy}
        className={`${btnBase} border border-black/[0.12] bg-white text-[#0c0e14] hover:bg-black/[0.03] disabled:opacity-50`}
      >
        {festivalInPlan ? "Премахни от моя план" : "Добави в моя план"}
      </button>
      <a
        href={icsHref}
        className={`${btnBase} border border-black/[0.12] bg-white text-[#0c0e14] hover:bg-black/[0.03]`}
      >
        Добави в календара
      </a>
      {mapHref ? (
        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          className={`${btnBase} border border-black/[0.12] bg-white text-[#0c0e14] hover:bg-black/[0.03]`}
        >
          Навигация
        </a>
      ) : null}
    </div>
  );
}
