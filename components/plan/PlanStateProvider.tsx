"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReminderType } from "@/lib/plan/server";

type PlanStatePayload = {
  authenticated: boolean;
  scheduleItemIds: string[];
  reminders: Record<string, ReminderType>;
};

type PlanContextValue = {
  isAuthenticated: boolean;
  authRequired: boolean;
  isScheduleItemInPlan: (scheduleItemId?: string | null) => boolean;
  toggleScheduleItem: (scheduleItemId?: string | null) => Promise<void>;
  reminderTypeByFestivalId: Record<string, ReminderType>;
  isFestivalReminded: (festivalId?: string | null) => boolean;
  setFestivalReminder: (festivalId: string, reminderType: ReminderType) => Promise<void>;
  refreshPlanState: () => Promise<void>;
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
  const [authenticated, setAuthenticated] = useState(isAuthenticated);

  const applyState = useCallback((payload: PlanStatePayload) => {
    setAuthenticated(payload.authenticated);
    if (payload.authenticated) {
      setAuthRequired(false);
    }
    setScheduleItemIds(new Set(payload.scheduleItemIds.map(String)));
    setReminders(payload.reminders ?? {});
  }, []);

  const refreshPlanState = useCallback(async () => {
    const response = await fetch("/api/plan/state", { cache: "no-store" });

    if (response.status === 401) {
      applyState({ authenticated: false, scheduleItemIds: [], reminders: {} });
      return;
    }

    if (!response.ok) return;

    const payload = (await response.json()) as PlanStatePayload;
    applyState(payload);
  }, [applyState]);

  useEffect(() => {
    const onFocus = () => {
      void refreshPlanState();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshPlanState();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshPlanState]);

  const toggleScheduleItem = useCallback(async (scheduleItemId?: string | null) => {
    if (!scheduleItemId) return;

    if (!authenticated) {
      setAuthRequired(true);
      return;
    }

    const id = String(scheduleItemId);
    const previous = new Set(scheduleItemIds);
    const optimisticInPlan = !previous.has(id);

    setScheduleItemIds((prev) => {
      const next = new Set(prev);
      if (optimisticInPlan) next.add(id);
      else next.delete(id);
      return next;
    });

    const response = await fetch("/api/plan/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleItemId: id }),
    });

    if (response.status === 401) {
      setAuthRequired(true);
      setScheduleItemIds(previous);
      setAuthenticated(false);
      return;
    }

    if (!response.ok) {
      setScheduleItemIds(previous);
      await refreshPlanState();
      return;
    }

    const payload = (await response.json()) as { inPlan?: boolean };
    setScheduleItemIds((prev) => {
      const next = new Set(prev);
      if (payload.inPlan) next.add(id);
      else next.delete(id);
      return next;
    });
  }, [authenticated, refreshPlanState, scheduleItemIds]);

  const setFestivalReminder = useCallback(async (festivalId: string, reminderType: ReminderType) => {
    if (!authenticated) {
      setAuthRequired(true);
      return;
    }

    const normalizedFestivalId = String(festivalId);
    const previous = { ...reminders };

    setReminders((prev) => {
      const next = { ...prev };
      if (reminderType === "none") delete next[normalizedFestivalId];
      else next[normalizedFestivalId] = reminderType;
      return next;
    });

    const response = await fetch("/api/plan/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ festivalId: normalizedFestivalId, reminderType }),
    });

    if (response.status === 401) {
      setAuthRequired(true);
      setAuthenticated(false);
      setReminders(previous);
      return;
    }

    if (!response.ok) {
      setReminders(previous);
      await refreshPlanState();
    }
  }, [authenticated, refreshPlanState, reminders]);

  const value: PlanContextValue = {
    isAuthenticated: authenticated,
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
    refreshPlanState,
  };

  return <PlanStateContext.Provider value={value}>{children}</PlanStateContext.Provider>;
}

export function usePlanState() {
  const context = useContext(PlanStateContext);
  if (!context) {
    throw new Error("usePlanState must be used within PlanStateProvider");
  }

  return context;
}
