"use client";

import { useCallback } from "react";
import { storeLinks } from "@/lib/deepLink";

export default function OpenInAppButton({ deepLink }: { deepLink: string }) {
  const handleClick = useCallback(() => {
    const { appStore, playStore } = storeLinks();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;
    const fallback = isIOS ? appStore : playStore;
    window.location.href = deepLink;
    if (isMobile) {
      window.setTimeout(() => {
        window.location.href = fallback;
      }, 1000);
    }
  }, [deepLink]);

  return (
    <button
      onClick={handleClick}
      className="rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
    >
      Open in app / Save to plan
    </button>
  );
}
