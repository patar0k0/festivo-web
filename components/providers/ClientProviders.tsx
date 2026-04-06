"use client";

import { NavigationGenerationProvider } from "@/components/providers/NavigationGenerationProvider";
import { PlanStateProvider } from "@/components/plan/PlanStateProvider";

type ClientProvidersProps = {
  children: React.ReactNode;
};

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <NavigationGenerationProvider>
      <PlanStateProvider
        initialScheduleItemIds={[]}
        initialFestivalIds={[]}
        initialReminders={{}}
        isAuthenticated={false}
      >
        {children}
      </PlanStateProvider>
    </NavigationGenerationProvider>
  );
}
