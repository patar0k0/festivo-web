/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // `remotePatterns` is authoritative for wildcards (e.g. `**.supabase.co`).
    // `domains` remains for hosts that do not need path rules (Next still resolves these).
    domains: ["images.unsplash.com", "img.youtube.com"],
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 дни
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
    ],
  },
  async headers() {
    // Domains used by Festivo:
    // - connect.facebook.net: Meta Pixel script
    // - www.facebook.com: Meta Pixel beacon
    // - *.supabase.co: Supabase API + Storage
    // - *.fbcdn.net: Facebook CDN (organizer/festival images from FB)
    // - img.youtube.com: YouTube thumbnails
    // - images.unsplash.com: Unsplash images
    // - *.vercel-insights.com + *.vercel-scripts.com: Vercel Analytics
    // - www.youtube.com + youtube.com: YouTube embeds (map section)
    // - www.google.com + maps.google.com: Google Maps embeds
    // - challenges.cloudflare.com: Cloudflare Turnstile (anti-bot on signup/organizer forms)
    // - cloud.umami.is: Umami Cloud analytics (script + beacons)
    // - *.googletagmanager.com + *.google-analytics.com: GA4 / Tag Manager
    // Sentry uses tunnelRoute="/monitoring" → same origin, no external CSP entry needed
    // Fonts are self-hosted via next/font → no fonts.googleapis.com needed
    // Next.js webpack dev server (next dev, non-Turbopack) wraps modules with eval()
    // for its default devtool — without 'unsafe-eval' the browser silently refuses to
    // run ANY client JS in dev (no hydration, no onClick/onSubmit). Production builds
    // don't use eval-based source maps, so this stays out of the deployed CSP.
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      "connect.facebook.net",
      "challenges.cloudflare.com",
      "cloud.umami.is",
      "*.googletagmanager.com",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ].join(" ");

    const csp = [
      "default-src 'self'",
      // Next.js App Router requires 'unsafe-inline' for streaming/hydration scripts.
      // Meta Pixel base code loads from connect.facebook.net.
      // Turnstile loads its widget script from challenges.cloudflare.com.
      // Umami script: cloud.umami.is. GA4/GTM scripts: *.googletagmanager.com.
      `script-src ${scriptSrc}`,
      // Tailwind CSS uses inline styles
      "style-src 'self' 'unsafe-inline'",
      // Images: Supabase storage, Facebook CDN, YouTube thumbnails, Unsplash,
      // FB pixel noscript, GA collect pixel, OpenStreetMap raster tiles
      // (sub-domains a/b/c.tile.openstreetmap.org — used by /map page).
      "img-src 'self' data: blob: *.supabase.co *.fbcdn.net img.youtube.com images.unsplash.com www.facebook.com *.google-analytics.com *.googletagmanager.com *.tile.openstreetmap.org",
      // Fonts self-hosted via next/font/google (downloaded at build time)
      "font-src 'self'",
      // API calls: Supabase, Vercel Analytics beacons, Facebook pixel events, Turnstile token verification,
      //            Umami event beacons (script loaded from cloud.umami.is, sends to gateway.umami.is),
      //            GA4 measurement protocol
      "connect-src 'self' *.supabase.co *.vercel-insights.com *.vercel-scripts.com www.facebook.com challenges.cloudflare.com cloud.umami.is gateway.umami.is api-gateway.umami.dev *.google-analytics.com *.analytics.google.com *.googletagmanager.com",
      // Embeds: YouTube videos (youtube-nocookie.com used by videoEmbed.ts), Google Maps, Turnstile challenge iframe, GTM noscript iframe
      "frame-src www.youtube.com youtube.com www.youtube-nocookie.com youtube-nocookie.com www.google.com maps.google.com challenges.cloudflare.com www.googletagmanager.com",
      "media-src 'self' blob:",
      "worker-src blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;


// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  org: process.env.SENTRY_ORG ?? "festivobg-ltd",
  project: process.env.SENTRY_PROJECT ?? "festivo-web",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  webpack: {
    // Tree-shake Sentry logger statements to reduce bundle size (replaces deprecated disableLogger)
    treeshake: {
      removeDebugLogging: true,
    },
    // Automatically instrument Vercel Cron Monitors (replaces deprecated automaticVercelMonitors)
    automaticVercelMonitors: true,
  },
});
