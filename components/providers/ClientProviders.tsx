"use client";

import { PlanStateProvider } from "@/components/plan/PlanStateProvider";

type ClientProvidersProps = {
  children: React.ReactNode;
};

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PlanStateProvider initialScheduleItemIds={[]} initialFestivalIds={[]} initialReminders={{}} isAuthenticated={false}>
      {children}
    </PlanStateProvider>
  );
}
