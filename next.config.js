/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // `remotePatterns` is authoritative for wildcards (e.g. `**.supabase.co`).
    // `domains` remains for hosts that do not need path rules (Next still resolves these).
    domains: ["images.unsplash.com", "img.youtube.com"],
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
    // Sentry uses tunnelRoute="/monitoring" → same origin, no external CSP entry needed
    // Fonts are self-hosted via next/font → no fonts.googleapis.com needed
    const csp = [
      "default-src 'self'",
      // Next.js App Router requires 'unsafe-inline' for streaming/hydration scripts
      // Meta Pixel base code loads from connect.facebook.net
      "script-src 'self' 'unsafe-inline' connect.facebook.net",
      // Tailwind CSS uses inline styles
      "style-src 'self' 'unsafe-inline'",
      // Images: Supabase storage, Facebook CDN, YouTube thumbnails, Unsplash, FB pixel noscript
      "img-src 'self' data: blob: *.supabase.co *.fbcdn.net img.youtube.com images.unsplash.com www.facebook.com",
      // Fonts self-hosted via next/font/google (downloaded at build time)
      "font-src 'self'",
      // API calls: Supabase, Vercel Analytics beacons, Facebook pixel events
      "connect-src 'self' *.supabase.co *.vercel-insights.com *.vercel-scripts.com www.facebook.com",
      // Embeds: YouTube videos, Google Maps
      "frame-src www.youtube.com youtube.com www.google.com maps.google.com",
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

  // Automatically instrument Vercel Cron Monitors
  automaticVercelMonitors: true,

  // Tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
});
