// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://964f219eb9d544b88e5750072572d1db@o4511407392358400.ingest.de.sentry.io/4511407450292304",

  // 10% от edge transactions — достатъчно за production insights без излишни разходи
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // GDPR: не изпращаме PII (IP адреси, email адреси и т.н.)
  sendDefaultPii: false,
});
