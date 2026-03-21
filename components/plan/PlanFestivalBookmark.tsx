"use client";

import Link from "next/link";
import { SyntheticEvent, useState } from "react";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import type { ReminderType } from "@/lib/plan/server";

type PlanFestivalBookmarkProps = {
  festivalId: string;
  /** Link to festival detail (програма се избира там). */
  programmeHref?: string | null;
  compact?: boolean;
};

const LOGIN_HREF = "/login";

export default function PlanFestivalBookmark({ festivalId, programmeHref, compact = true }: PlanFestivalBookmarkProps) {
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

        {programmeHref ? (
          <Link
            href={programmeHref}
            onClick={stopEvent}
            className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          >
            Програма
          </Link>
        ) : null}

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
      </div>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      {!isAuthenticated || authRequired ? (
        <p className="text-xs text-black/55">
          Влез, за да запазваш фестивали и напомняния. <Link href={LOGIN_HREF} className="underline">Вход</Link>
        </p>
      ) : null}
    </div>
  );
}
