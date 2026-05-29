"use client";

import { lazy, Suspense, useCallback, useState } from "react";
import { usePlanState } from "@/components/plan/PlanStateProvider";

const ReportFestivalModal = lazy(() => import("@/components/festival/ReportFestivalModal"));

type HeroProps = {
  festivalId: string;
  icsHref: string;
  showPlanAction?: boolean;
  showCalendarAction?: boolean;
  /** When set, guests call this instead of context-only auth hint (e.g. open login modal). */
  onGuestPlanClick?: () => void;
};

/**
 * Hero / top zone: primary CTA = Add to Plan, secondary = Add to Calendar.
 */
export function FestivalHeroActionBar({
  festivalId,
  icsHref,
  showPlanAction = true,
  showCalendarAction = true,
  onGuestPlanClick,
}: HeroProps) {
  const { isAuthenticated, requireAuthForPlan, toggleFestivalPlan, festivalIds } = usePlanState();
  const [planBusy, setPlanBusy] = useState(false);

  const festivalInPlan = festivalIds.includes(festivalId);
  const isGuest = !isAuthenticated;

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

  const primaryClass =
    isGuest
      ? "inline-flex min-h-[56px] w-full flex-[1.2] items-center justify-center gap-2 rounded-xl bg-black/10 px-4 py-3 text-center text-[15px] font-semibold text-black/65 shadow-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:min-w-[12rem]"
      : festivalInPlan
        ? "inline-flex min-h-[56px] w-full flex-[1.2] items-center justify-center gap-2 rounded-xl border border-[#7c2d12]/30 bg-[#7c2d12]/10 px-4 py-3 text-center text-[15px] font-semibold text-[#7c2d12] transition-all duration-200 hover:bg-[#7c2d12]/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/30 sm:min-w-[12rem]"
        : "inline-flex min-h-[56px] w-full flex-[1.2] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ff5c32] to-[#ff4c1f] px-4 py-3 text-center text-[15px] font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:from-[#ff6438] hover:to-[#f2491c] hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/40 sm:min-w-[12rem]";

  const secondaryClass =
    "inline-flex min-h-[44px] w-full flex-1 items-center justify-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-center text-sm font-semibold text-black/90 transition-all duration-150 hover:bg-black/[0.04] hover:opacity-[0.98] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 sm:min-w-[10rem]";

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        {showPlanAction ? (
          <button
            type="button"
            onClick={() => void onPlan()}
            disabled={planBusy}
            className={primaryClass}
          >
            {festivalInPlan ? "✔ В плана ти" : "♡ Добави в плана"}
          </button>
        ) : null}
        {showCalendarAction ? (
          <a href={icsHref} className={secondaryClass}>
            Добави в календара
          </a>
        ) : null}
      </div>
      {showPlanAction && !isGuest ? (
        <p className="text-xs leading-relaxed text-black/60">
          {festivalInPlan
            ? "Настрой напомняне от дясната колона →"
            : "Добави в плана, за да получаваш напомняния"}
        </p>
      ) : null}
    </div>
  );
}

type RailProps = {
  festivalId: string;
};

/**
 * Rail: report only — plan is in hero CTA, maps is under the map section.
 */
export function FestivalRailActionBar({ festivalId }: RailProps) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="pt-1 text-center">
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="text-xs text-black/35 hover:text-black/60 hover:underline"
      >
        ⚑ Сигнализирай за проблем
      </button>

      {reportOpen && (
        <Suspense fallback={null}>
          <ReportFestivalModal
            festivalId={festivalId}
            onClose={() => setReportOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
