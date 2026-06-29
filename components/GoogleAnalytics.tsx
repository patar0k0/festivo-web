"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/**
 * Google Analytics 4 + (optional) Google Tag Manager.
 *
 * GA4 директно (без GTM) работи самостоятелно. Ако GTM е конфигуриран,
 * по-добре зарежда GA4 през GTM (контейнерът става централна точка за
 * всички tracking pixels: GA4, Google Ads, и т.н.).
 *
 * Конфигурация:
 *   NEXT_PUBLIC_GA4_MEASUREMENT_ID  — формат "G-XXXXXXXXXX"; от GA4 → Admin → Data Streams
 *   NEXT_PUBLIC_GTM_ID              — формат "GTM-XXXXXXX"; от GTM dashboard (по желание)
 *
 * ⚠️ GA4 използва cookies → ЗАРЕЖДА СЕ САМО след analytics consent
 * (този компонент трябва да се рендерира от `ConsentGatedAnalytics`).
 *
 * Custom events:
 *   window.gtag?.("event", "save_festival", { festival_id: "..." });
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();

  // Admin panel usage is internal/operator traffic, not real visitors — suppress GA4 hits
  // there. `ga-disable-<id>` is gtag.js's own opt-out flag, so it also covers SPA
  // navigation into/out of /admin after the tag has already loaded.
  useEffect(() => {
    if (!MEASUREMENT_ID) return;
    const w = window as unknown as Record<string, boolean>;
    w[`ga-disable-${MEASUREMENT_ID}`] = pathname?.startsWith("/admin") ?? false;
  }, [pathname]);

  // Prefer GTM if present (it loads GA4 internally), else fall back to direct gtag.js.
  if (GTM_ID) {
    return (
      <>
        <Script id="gtm-init" strategy="lazyOnload">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="gtm"
          />
        </noscript>
      </>
    );
  }

  if (!MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        id="ga4-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="lazyOnload"
      />
      <Script id="ga4-init" strategy="lazyOnload">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}', {
            anonymize_ip: true,
            allow_google_signals: false
          });`}
      </Script>
    </>
  );
}
