"use client";

import { useEffect, useRef } from "react";
import { useNavigationGeneration } from "@/components/providers/NavigationGenerationProvider";

/**
 * Clears image error/retry state when identity deps change and on every client navigation
 * (history push/replace/popstate), so soft back/forward to the same URL still recovers
 * without remount, hard refresh, pageshow, or visibilitychange.
 */
export function useImageLoadReset(reset: () => void, ...deps: unknown[]) {
  const navigationGeneration = useNavigationGeneration();
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    resetRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are explicit rest args
  }, [navigationGeneration, ...deps]);
}
