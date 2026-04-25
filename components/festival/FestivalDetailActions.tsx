"use client";

import { useCallback, useState } from "react";
import type { ReminderType } from "@/lib/plan/server";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import { logGoogleMapsOpenDebug } from "@/lib/location/buildGoogleMapsUrl";
import { outboundClickHref } from "@/lib/outbound/outboundLink";

type HeroProps = {
  festivalId: string;
  icsHref: string;
  reminderAnchorId: string;
  /** When set, guests call this instead of context-only auth hint (e.g. open login modal). */
  onGuestReminderClick?: () => void;
};

/**
 * Hero / top zone: single primary CTA (reminder) + calendar as secondary.
 */
export function FestivalHeroActionBar({ festivalId, icsHref, reminderAnchorId, onGuestReminderClick }: HeroProps) {
  const { isAuthenticated, requireAuthForPlan, reminderTypeByFestivalId, setFestivalReminder } = usePlanState();

  const reminder = reminderTypeByFestivalId[festivalId] ?? "none";

  const scrollToReminder = useCallback(() => {
    const el = document.getElementById(reminderAnchorId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reminderAnchorId]);

  const onReminderPrimary = useCallback(async () => {
    if (!isAuthenticated) {
      if (onGuestReminderClick) {
        onGuestReminderClick();
      } else {
        requireAuthForPlan();
      }
      return;
    }
    if (reminder === "none") {
      await setFestivalReminder(festivalId, "24h" as ReminderType);
    }
    scrollToReminder();
  }, [festivalId, isAuthenticated, onGuestReminderClick, reminder, requireAuthForPlan, scrollToReminder, setFestivalReminder]);

  const primaryReminderLabel =
    reminder === "none"
      ? "🔔 Напомни ми за началото"
      : reminder === "24h"
        ? "🔔 Ще ти напомним 1 ден по-рано"
        : "🔔 Ще ти напомним в деня в 09:00";

  const heroReminderHelper =
    reminder === "none" ? "Ще ти напомним за началото на събитието" : "Напомнянето е включено";

  const isGuest = !isAuthenticated;
  const primaryClass = isGuest
    ? "inline-flex min-h-[56px] w-full flex-[1.2] items-center justify-center gap-2 rounded-xl bg-black/10 px-4 py-3 text-center text-[15px] font-semibold text-black/40 shadow-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:min-w-[12rem]"
    : "inline-flex min-h-[56px] w-full flex-[1.2] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ff5c32] to-[#ff4c1f] px-4 py-3 text-center text-[15px] font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:from-[#ff6438] hover:to-[#f2491c] hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/40 sm:min-w-[12rem]";
  const secondaryClass =
    "inline-flex min-h-[44px] w-full flex-1 items-center justify-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-center text-sm font-semibold text-black/90 transition-all duration-150 hover:bg-black/[0.04] hover:opacity-[0.98] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 sm:min-w-[10rem]";

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <button type="button" onClick={() => void onReminderPrimary()} className={primaryClass}>
          {primaryReminderLabel}
        </button>
        <a href={icsHref} className={secondaryClass}>
          Добави в календара
        </a>
      </div>
      <p className="text-xs leading-relaxed text-black/60">{heroReminderHelper}</p>
    </div>
  );
}

type RailProps = {
  festivalId: string;
  mapHref: string | null;
  onGuestPlanClick?: () => void;
};

/**
 * Rail: planning + navigation only (reminder timing lives in the same aside card below).
 */
export function FestivalRailActionBar({ festivalId, mapHref, onGuestPlanClick }: RailProps) {
  const { isAuthenticated, requireAuthForPlan, toggleFestivalPlan, festivalIds } = usePlanState();
  const [planBusy, setPlanBusy] = useState(false);

  const isGuest = !isAuthenticated;
  const festivalInPlan = festivalIds.includes(festivalId);

  const onPlan = useCallback(async () => {
    if (!isAuthenticated) {
      if (onGuestPlanClick) {
        onGuestPlanClick();
      } else {
        requireAuthForPlan();
      }
      return;
    }
    setPlanBusy(true);
    try {
      await toggleFestivalPlan(festivalId);
    } finally {
      setPlanBusy(false);
    }
  }, [festivalId, isAuthenticated, onGuestPlanClick, requireAuthForPlan, toggleFestivalPlan]);

  const planBtnClass =
    "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 disabled:opacity-50";
  const navClass =
    "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.1em] text-black/90 transition-all duration-150 hover:border-black/20 hover:bg-black/[0.04] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25";

  const planButtonClass = planBusy
    ? `${planBtnClass} border border-black/[0.1] bg-white text-black/90 opacity-50`
    : festivalInPlan && !isGuest
      ? `${planBtnClass} border border-[#7c2d12]/30 bg-[#7c2d12]/10 text-[#7c2d12] hover:opacity-95`
      : isGuest
        ? `${planBtnClass} bg-black/10 text-black/40`
        : `${planBtnClass} bg-[#7c2d12] text-white hover:opacity-90`;

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void onPlan()} disabled={planBusy} className={planButtonClass}>
        {festivalInPlan ? "✔ В плана ти" : "Добави в моя план"}
      </button>
      {mapHref ? (
        <a
          href={outboundClickHref({
            targetUrl: mapHref,
            festivalId,
            type: "maps",
            source: "festival_detail",
          })}
          target="_blank"
          rel="noreferrer"
          className={navClass}
          onClick={() => logGoogleMapsOpenDebug(mapHref)}
        >
          Отвори в Google Maps
        </a>
      ) : null}
    </div>
  );
}
