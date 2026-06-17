// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Само реални deploy-и (Vercel production + preview = NODE_ENV=production) пращат
  // към Sentry; локалната разработка (NODE_ENV=development) не изпраща — иначе dev
  // грешки шумят и хабят quota-та.
  enabled: process.env.NODE_ENV === "production",

  // 10% от server transactions — достатъчно за production insights без излишни разходи
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // GDPR: не изпращаме PII (IP адреси, email адреси и т.н.)
  sendDefaultPii: false,
});
