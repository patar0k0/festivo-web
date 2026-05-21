"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

type Props = {
  /** Subscription source — recorded server-side for analytics. */
  source?: "footer" | "popup" | "landing";
  /** Optional compact mode (smaller text, no eyebrow). */
  compact?: boolean;
};

export function NewsletterSignup({ source = "footer", compact = false }: Props) {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    setBusy(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source,
          website: honeypot,
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok) {
        setError(payload?.error?.trim() || "Възникна грешка. Опитай отново.");
        return;
      }

      setOk(true);
      setEmail("");
      setHoneypot("");
    } catch {
      setError("Мрежова грешка. Опитай отново.");
    } finally {
      setBusy(false);
    }
  }

  const inputId = `newsletter-email-${source}`;
  const honeypotId = `newsletter-website-${source}`;

  return (
    <form className="relative" onSubmit={onSubmit} noValidate>
      {!compact ? (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/60">
          Бюлетин
        </p>
      ) : null}

      <p
        className={cn(
          "leading-relaxed text-black/70",
          compact ? "mt-0 text-sm" : "mt-3 text-sm",
        )}
      >
        Получавай най-интересните фестивали за месеца — без спам, един имейл месечно.
      </p>

      {/* Honeypot: must stay empty (bots fill all fields). */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={honeypotId}>Website</label>
        <input
          id={honeypotId}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(ev) => setHoneypot(ev.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor={inputId} className="sr-only">
            Имейл адрес
          </label>
          <input
            id={inputId}
            name="email"
            type="email"
            required
            maxLength={320}
            placeholder="твоят@имейл.bg"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className={cn(pub.input)}
            disabled={busy || ok}
          />
        </div>
        <button
          type="submit"
          className={cn(pub.btnPrimarySm, pub.focusRing, "shrink-0 sm:min-w-[120px]")}
          disabled={busy || ok}
        >
          {busy ? "Записва…" : ok ? "Записан ✓" : "Запиши се"}
        </button>
      </div>

      {error ? (
        <p
          className="mt-3 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-xs text-red-900/90"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {ok ? (
        <p className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-900/90">
          Готово! Записахме те за бюлетина.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-black/50">
        С абонирането приемаш{" "}
        <Link href="/privacy" className="font-medium underline underline-offset-2 hover:text-black/75">
          политиката за поверителност
        </Link>
        . Можеш да се отпишеш по всяко време.
      </p>
    </form>
  );
}
