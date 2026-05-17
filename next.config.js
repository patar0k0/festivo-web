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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
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
