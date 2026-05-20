import Script from "next/script";

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() || "https://cloud.umami.is/script.js";

/**
 * Umami Cloud analytics — privacy-first pageview tracking без cookies.
 *
 * GDPR-friendly: не изисква cookie consent, защото не съхранява
 * персонална data (anonymous fingerprint, ротиран всеки 24h).
 *
 * Конфигурация:
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID  — задължително; от Umami dashboard
 *   NEXT_PUBLIC_UMAMI_SCRIPT_URL  — по желание; default = cloud.umami.is/script.js
 *                                   (за self-hosted: https://your-umami.example.com/script.js)
 *
 * Custom events (от което и да е client component):
 *   window.umami?.track("button_click", { label: "save_festival" });
 */
export default function UmamiAnalytics() {
  if (!WEBSITE_ID) return null;

  return (
    <Script
      id="umami-analytics"
      src={SCRIPT_URL}
      data-website-id={WEBSITE_ID}
      strategy="afterInteractive"
      defer
    />
  );
}
