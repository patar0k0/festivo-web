"use client";

import { useEffect, useState } from "react";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { FESTIVO_COOKIE_CONSENT_CHANGED_EVENT, FESTIVO_COOKIE_CONSENT_KEY } from "@/components/CookieConsentBanner";

function readAnalyticsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(FESTIVO_COOKIE_CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return false;
    const o = parsed as Record<string, unknown>;
    return o.analytics === true;
  } catch {
    return false;
  }
}

/**
 * Cookie-based analytics that REQUIRE user consent under GDPR.
 * Currently gates: Google Analytics 4 / Tag Manager.
 *
 * Note: Vercel Analytics is loaded unconditionally in `layout.tsx` because it
 * does not set cookies and is GDPR-compliant out of the box.
 * Umami is also unconditional (no cookies, anonymized).
 */
export default function ConsentGatedAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(readAnalyticsAllowed());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(FESTIVO_COOKIE_CONSENT_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(FESTIVO_COOKIE_CONSENT_CHANGED_EVENT, sync);
    };
  }, []);

  if (!allowed) return null;
  return <GoogleAnalytics />;
}
