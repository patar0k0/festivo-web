"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReminderType } from "@/lib/plan/server";

type PlanContextValue = {
  isAuthenticated: boolean;
  authRequired: boolean;
  isScheduleItemInPlan: (scheduleItemId?: string | null) => boolean;
  toggleScheduleItem: (scheduleItemId?: string | null) => Promise<void>;
  reminderTypeByFestivalId: Record<string, ReminderType>;
  isFestivalReminded: (festivalId?: string | null) => boolean;
  setFestivalReminder: (festivalId: string, reminderType: ReminderType) => Promise<void>;
};

const PlanStateContext = createContext<PlanContextValue | null>(null);

type PlanStateProviderProps = {
  children: React.ReactNode;
  initialScheduleItemIds: string[];
  initialReminders: Record<string, ReminderType>;
  isAuthenticated: boolean;
};

export function PlanStateProvider({
  children,
  initialScheduleItemIds,
  initialReminders,
  isAuthenticated,
}: PlanStateProviderProps) {
  const [scheduleItemIds, setScheduleItemIds] = useState<Set<string>>(new Set(initialScheduleItemIds));
  const [reminders, setReminders] = useState<Record<string, ReminderType>>(initialReminders);
  const [authRequired, setAuthRequired] = useState(false);

  const toggleScheduleItem = async (scheduleItemId?: string | null) => {
    if (!scheduleItemId) return;

    if (!isAuthenticated) {
      setAuthRequired(true);
      return;
    }

    const response = await fetch("/api/plan/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleItemId }),
    });

    if (!response.ok) return;

    const payload = (await response.json()) as { inPlan?: boolean };
    setScheduleItemIds((prev) => {
      const next = new Set(prev);
      if (payload.inPlan) {
        next.add(scheduleItemId);
      } else {
        next.delete(scheduleItemId);
      }
      return next;
    });
  };

  const setFestivalReminder = async (festivalId: string, reminderType: ReminderType) => {
    if (!isAuthenticated) {
      setAuthRequired(true);
      return;
    }

    const response = await fetch("/api/plan/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ festivalId, reminderType }),
    });

    if (!response.ok) return;

    setReminders((prev) => {
      const next = { ...prev };
      if (reminderType === "none") {
        delete next[festivalId];
      } else {
        next[festivalId] = reminderType;
      }
      return next;
    });
  };

  const value = useMemo<PlanContextValue>(
    () => ({
      isAuthenticated,
      authRequired,
      isScheduleItemInPlan: (scheduleItemId?: string | null) => {
        if (!scheduleItemId) return false;
        return scheduleItemIds.has(String(scheduleItemId));
      },
      toggleScheduleItem,
      reminderTypeByFestivalId: reminders,
      isFestivalReminded: (festivalId?: string | null) => {
        if (!festivalId) return false;
        return reminders[String(festivalId)] !== undefined;
      },
      setFestivalReminder,
    }),
    [isAuthenticated, authRequired, reminders, scheduleItemIds]
  );

  return <PlanStateContext.Provider value={value}>{children}</PlanStateContext.Provider>;
}

export function usePlanState() {
  const context = useContext(PlanStateContext);
  if (!context) {
    throw new Error("usePlanState must be used within PlanStateProvider");
  }

  return context;
}
