"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const NavigationGenerationContext = createContext(0);

/**
 * Increments on every client history transition Next.js uses (pushState / replaceState)
 * and on browser back/forward (popstate). Covers soft navigations and BF-style restores
 * where pathname and document URL can match a prior visit but React state must reset.
 */
export function NavigationGenerationProvider({ children }: { children: React.ReactNode }) {
  const [generation, setGeneration] = useState(0);
  const bump = useCallback(() => {
    setGeneration((g) => g + 1);
  }, []);

  useEffect(() => {
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    const patchedPush: typeof history.pushState = (data, unused, url) => {
      origPush(data, unused, url);
      bump();
    };
    const patchedReplace: typeof history.replaceState = (data, unused, url) => {
      origReplace(data, unused, url);
      bump();
    };

    history.pushState = patchedPush;
    history.replaceState = patchedReplace;
    window.addEventListener("popstate", bump);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", bump);
    };
  }, [bump]);

  return <NavigationGenerationContext.Provider value={generation}>{children}</NavigationGenerationContext.Provider>;
}

export function useNavigationGeneration(): number {
  return useContext(NavigationGenerationContext);
}
