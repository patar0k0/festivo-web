"use client";

import { NavigationGenerationProvider } from "@/components/providers/NavigationGenerationProvider";
import { PlanStateProvider } from "@/components/plan/PlanStateProvider";

type ClientProvidersProps = {
  children: React.ReactNode;
  /**
   * Server-resolved auth state, threaded from `app/layout.tsx`.
   *
   * Without this, `PlanStateProvider` initializes with `isAuthenticated=false`
   * and only flips to `true` after the client-side `/api/plan/state` fetch
   * resolves. That means:
   *  - Logged-in users briefly see "Влез" messages during hydration.
   *  - If the fetch fails (5xx, network), they stay stuck in guest view
   *    indefinitely even though their session cookie is fine — which is the
   *    bug reported on the festival detail page in May 2026.
   *
   * Seeding the initial value server-side makes the first paint correct;
   * the client-side refresh becomes purely a data-sync step.
   */
  initialIsAuthenticated?: boolean;
};

export default function ClientProviders({
  children,
  initialIsAuthenticated = false,
}: ClientProvidersProps) {
  return (
    <NavigationGenerationProvider>
      <PlanStateProvider
        initialScheduleItemIds={[]}
        initialFestivalIds={[]}
        initialReminders={{}}
        isAuthenticated={initialIsAuthenticated}
      >
        {children}
      </PlanStateProvider>
    </NavigationGenerationProvider>
  );
}
