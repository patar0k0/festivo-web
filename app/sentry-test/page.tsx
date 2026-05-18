"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryTestPage() {
  const [sent, setSent] = useState(false);

  function triggerError() {
    Sentry.captureException(new Error("Festivo Sentry test error — ако виждаш това, мониторингът работи!"));
    setSent(true);
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Sentry Test</h1>
      {sent ? (
        <p style={{ color: "green" }}>✅ Грешката е изпратена към Sentry. Провери dashboard-а.</p>
      ) : (
        <button onClick={triggerError} style={{ padding: "12px 24px", fontSize: 16, cursor: "pointer" }}>
          Изпрати тест грешка към Sentry
        </button>
      )}
    </div>
  );
}
