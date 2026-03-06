"use client";

import Link from "next/link";
import { SyntheticEvent } from "react";
import { usePlanState } from "@/components/plan/PlanStateProvider";
import type { ReminderType } from "@/lib/plan/server";

type PlanInlineControlsProps = {
  festivalId: string;
  scheduleItemId?: string | null;
  compact?: boolean;
};

const LOGIN_HREF = "/login";

export default function PlanInlineControls({ festivalId, scheduleItemId, compact = true }: PlanInlineControlsProps) {
  const { isAuthenticated, authRequired, isScheduleItemInPlan, toggleScheduleItem, reminderTypeByFestivalId, setFestivalReminder } = usePlanState();

  const inPlan = isScheduleItemInPlan(scheduleItemId);
  const reminder = reminderTypeByFestivalId[String(festivalId)] ?? "none";

  const stopEvent = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={`space-y-2 ${compact ? "" : "mt-3"}`} onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            stopEvent(event);
            void toggleScheduleItem(scheduleItemId);
          }}
          disabled={!scheduleItemId}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
            inPlan
              ? "border-[#0c0e14] bg-[#0c0e14] text-white"
              : "border-black/[0.1] bg-white text-[#0c0e14] hover:bg-[#f7f6f3]"
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          {inPlan ? "Премахни" : "Добави в план"}
        </button>

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

      {!isAuthenticated || authRequired ? (
        <p className="text-xs text-black/55">
          Влез, за да ползваш Моят план. <Link href={LOGIN_HREF} className="underline">Вход</Link>
        </p>
      ) : null}
    </div>
  );
}
