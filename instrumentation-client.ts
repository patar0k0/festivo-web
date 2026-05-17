// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://964f219eb9d544b88e5750072572d1db@o4511407392358400.ingest.de.sentry.io/4511407450292304",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // 10% от transactions — достатъчно за production insights без излишни разходи
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Session replay — изключен за нормални сесии (GDPR и bandwidth)
  replaysSessionSampleRate: 0.0,

  // Session replay — включен само при грешки за debugging
  replaysOnErrorSampleRate: 1.0,

  // GDPR: не изпращаме PII (IP адреси, email адреси и т.н.)
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
