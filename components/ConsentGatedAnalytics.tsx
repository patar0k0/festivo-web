"use client";

import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
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
  return <Analytics />;
}
