"use client";

import { useCallback } from "react";
import { festivalDeepLink, storeLinks } from "@/lib/deepLink";

type Props = {
  slug: string;
};

export default function FestivalAppCta({ slug }: Props) {
  const deepLink = festivalDeepLink(slug);

  const openApp = useCallback(() => {
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
    <section
      className="rounded-2xl border border-black/[0.08] bg-gradient-to-br from-[#faf9f6] to-[#f3f1eb] p-5 shadow-[0_1px_0_rgba(12,14,20,0.04),0_6px_14px_rgba(12,14,20,0.05)]"
      aria-labelledby="festival-app-cta-heading"
    >
      <h2 id="festival-app-cta-heading" className="text-base font-semibold text-[#0c0e14]">
        📲 По-удобно в приложението
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-black/60">
        Напомняния, карта и личен план на едно място.
      </p>
      <button
        type="button"
        onClick={openApp}
        className="mt-4 w-full rounded-xl border border-black/[0.14] bg-white px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] shadow-[0_1px_0_rgba(12,14,20,0.04)] transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/30"
      >
        Отвори в приложението
      </button>
    </section>
  );
}
