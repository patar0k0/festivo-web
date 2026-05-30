import type { Metadata } from "next";
import { Cormorant_Garamond, Fraunces, Manrope } from "next/font/google";
import * as Sentry from "@sentry/nextjs";
import { Analytics } from "@vercel/analytics/next";
import MetaPixel from "@/components/MetaPixel";
import UmamiAnalytics from "@/components/UmamiAnalytics";
import ConsentGatedAnalytics from "@/components/ConsentGatedAnalytics";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import LayoutShell from "@/components/LayoutShell";
import ClientProviders from "@/components/providers/ClientProviders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";
import "./landing.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  // Non-critical font (organizer portal + coming-soon only) — don't block render.
  // First-visit users get a system fallback; font loads silently in the background.
  display: "optional",
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-hero-warm-serif",
  subsets: ["latin", "cyrillic"],
  weight: ["700"],
  display: "swap",
});

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://festivo.bg"),
    title: {
      default: "Festivo — Discover festivals in Bulgaria",
      template: "%s · Festivo",
    },
    description: "Browse published festivals, find dates, and plan weekends across Bulgaria.",
    icons: {
      icon: [
        { url: "/brand/icon-16.png", sizes: "16x16", type: "image/png" },
        { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/festivo-icon.svg", type: "image/svg+xml" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve auth server-side so PlanStateProvider can render the correct
  // initial UI for logged-in users without waiting on a client-side fetch.
  // We use the lightweight `supabase.auth.getUser()` call directly (rather
  // than `getOptionalUser`) to keep this resilient — if the users-table
  // soft-delete check fails, we still want the layout to render. The plan
  // state fetch in PlanStateProvider will catch the truly-deleted case.
  let initialIsAuthenticated = false;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    initialIsAuthenticated = Boolean(user?.id);
  } catch {
    initialIsAuthenticated = false;
  }

  const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace("https://", "").split("/")[0];

  return (
    <html lang="bg">
      <head>
        <meta charSet="utf-8" />
        {/* Preconnect за Supabase storage (снимки на фестивали) */}
        {supabaseHost ? (
          <>
            <link rel="preconnect" href={`https://${supabaseHost}`} />
            <link rel="dns-prefetch" href={`https://${supabaseHost}`} />
          </>
        ) : null}
        {/* Preconnect за Facebook CDN (организаторски снимки) */}
        <link rel="dns-prefetch" href="https://scontent.fsof9-1.fbcdn.net" />
      </head>
      <body
        className={`${manrope.variable} ${fraunces.variable} ${cormorantGaramond.variable} landing-bg min-h-screen text-[#0c0e14] antialiased`}
      >
        <ClientProviders initialIsAuthenticated={initialIsAuthenticated}>
          <LayoutShell>{children}</LayoutShell>
        </ClientProviders>
        <Analytics />
        <UmamiAnalytics />
        <MetaPixel />
        <ConsentGatedAnalytics />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
