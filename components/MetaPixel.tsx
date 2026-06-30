"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// First real interaction (or this fallback timeout, whichever comes first) triggers load —
// keeps PageView tracking for passive readers who never scroll/click within the window.
const FALLBACK_DELAY_MS = 8000;
const TRIGGER_EVENTS = ["scroll", "mousemove", "keydown", "touchstart", "click"] as const;

/**
 * Meta Pixel base code — деферира зареждането до първата реална user interaction
 * (или fallback timeout), за да не товари main thread-а при initial page load.
 * Pixel ID се чете от NEXT_PUBLIC_META_PIXEL_ID env var.
 */
export default function MetaPixel() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!PIXEL_ID) return;

    const load = () => setShouldLoad(true);
    const timer = window.setTimeout(load, FALLBACK_DELAY_MS);

    TRIGGER_EVENTS.forEach((event) =>
      window.addEventListener(event, load, { once: true, passive: true }),
    );

    return () => {
      window.clearTimeout(timer);
      TRIGGER_EVENTS.forEach((event) => window.removeEventListener(event, load));
    };
  }, []);

  if (!PIXEL_ID || !shouldLoad) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
