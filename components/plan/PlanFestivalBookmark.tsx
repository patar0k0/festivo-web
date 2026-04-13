"use client";

import Link from "next/link";
import { SyntheticEvent, useState } from "react";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import type { ReminderType } from "@/lib/plan/server";

type PlanFestivalBookmarkProps = {
  festivalId: string;
  /** Link to festival detail programme block (`#festival-program`). */
  programmeHref?: string | null;
  compact?: boolean;
  /** Listing cards: hide programme shortcut (default true elsewhere). */
  showProgrammeLink?: boolean;
  /** Listing cards: hide reminder select (default true elsewhere). */
  showReminder?: boolean;
  /** Compact heart control for card image overlay (save only). */
  variant?: "default" | "icon";
};

const LOGIN_HREF = "/login";

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-[#7c2d12]">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[#0c0e14]/70">
      <path
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PlanFestivalBookmark({
  festivalId,
  programmeHref,
  compact = true,
  showProgrammeLink = true,
  showReminder = true,
  variant = "default",
}: PlanFestivalBookmarkProps) {
  const {
    isAuthenticated,
    authRequired,
    requireAuthForPlan,
    isFestivalInPlan,
    setFestivalInPlan,
    reminderTypeByFestivalId,
    setFestivalReminder,
    refreshPlanState,
  } = usePlanState();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = isFestivalInPlan(festivalId);
  const reminder = reminderTypeByFestivalId[String(festivalId)] ?? "none";
  const programmeLink = showProgrammeLink && programmeHref ? programmeHref : null;

  const stopEvent = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const toggleSaved = async () => {
    if (!isAuthenticated) {
      requireAuthForPlan();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plan/festivals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ festivalId: String(festivalId) }),
      });

      if (response.status === 401) {
        setError("Нужен е вход в профила.");
        await refreshPlanState();
        return;
      }

      const payload = (await response.json()) as { inPlan?: boolean; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Възникна грешка при запазване.");
        await refreshPlanState();
        return;
      }

      setFestivalInPlan(String(festivalId), Boolean(payload.inPlan));
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={(event) => {
          stopEvent(event);
          void toggleSaved();
        }}
        disabled={loading}
        title={error ?? undefined}
        aria-label={saved ? "Премахни от плана" : "Запази в плана"}
        aria-pressed={saved}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.12] bg-white/95 shadow-sm backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/30 disabled:cursor-not-allowed disabled:opacity-45 ${
          saved ? "border-[#7c2d12]/35 bg-white" : "hover:bg-white"
        }`}
      >
        {loading ? <span className="text-xs text-black/50">…</span> : <HeartIcon filled={saved} />}
      </button>
    );
  }

  return (
    <div className={`space-y-2 ${compact ? "" : "mt-3"}`} onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            stopEvent(event);
            void toggleSaved();
          }}
          disabled={loading}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
            saved
              ? "border-[#0c0e14] bg-[#0c0e14] text-white"
              : "border-black/[0.1] bg-white text-[#0c0e14] hover:bg-[#f7f6f3]"
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          {loading ? "…" : saved ? "Запазено" : "Запази"}
        </button>

        {programmeLink ? (
          <Link
            href={programmeLink}
            onClick={stopEvent}
            className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          >
            Програма
          </Link>
        ) : null}

        {showReminder ? (
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
            Напомняне
            <select
              value={reminder}
              onClick={stopEvent}
              onChange={(event) => {
                stopEvent(event);
                void setFestivalReminder(String(festivalId), event.target.value as ReminderType);
              }}
              disabled={!isAuthenticated}
              className="ml-2 rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-xs text-[#0c0e14] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <option value="none">Без</option>
              <option value="24h">24h</option>
              <option value="same_day_09">09:00</option>
            </select>
          </label>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      {!isAuthenticated || authRequired ? (
        <p className="text-xs text-black/55">
          {showReminder ? (
            <>
              Влез, за да запазваш фестивали и напомняния. <Link href={LOGIN_HREF} className="underline">Вход</Link>
            </>
          ) : (
            <>
              Влез, за да запазваш фестивали. <Link href={LOGIN_HREF} className="underline">Вход</Link>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
