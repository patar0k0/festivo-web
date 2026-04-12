"use client";

import Link from "next/link";
import { FormEvent, useCallback, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import { SITE_ADMIN_EMAIL } from "@/lib/siteContact";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const needsTurnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  const onTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);
  const onTurnstileError = useCallback(() => setTurnstileToken(""), []);
  const onTurnstileExpire = useCallback(() => setTurnstileToken(""), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          website: honeypot,
          turnstileToken: needsTurnstile ? turnstileToken : "",
        }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(payload?.error?.trim() || "Възникна грешка. Опитай отново.");
        turnstileRef.current?.reset();
        setTurnstileToken("");
        return;
      }
      setOk(true);
      setName("");
      setEmail("");
      setMessage("");
      setHoneypot("");
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } catch {
      setError("Мрежова грешка. Опитай отново.");
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="relative mt-8 space-y-5" onSubmit={onSubmit} noValidate>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(ev) => setHoneypot(ev.target.value)}
        />
      </div>

      <div>
        <label className={pub.label} htmlFor="contact-name">
          Име
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          className={cn(pub.input, "mt-1.5")}
        />
      </div>

      <div>
        <label className={pub.label} htmlFor="contact-email">
          Имейл
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className={cn(pub.input, "mt-1.5")}
        />
      </div>

      <div>
        <label className={pub.label} htmlFor="contact-message">
          Съобщение
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={6000}
          value={message}
          onChange={(ev) => setMessage(ev.target.value)}
          className={cn(pub.input, "mt-1.5 min-h-[140px] resize-y")}
        />
        <p className={cn(pub.caption, "mt-1.5")}>Минимум 10 символа.</p>
      </div>

      {needsTurnstile ? (
        <TurnstileWidget
          ref={turnstileRef}
          onSuccess={onTurnstileSuccess}
          onError={onTurnstileError}
          onExpire={onTurnstileExpire}
        />
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-900/90" role="alert">
          {error}
        </p>
      ) : null}

      {ok ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900/90">
          Съобщението е изпратено. Ще се свържем при нужда на посочения имейл.
        </p>
      ) : null}

      <button
        type="submit"
        className={cn(pub.btnPrimaryFull, pub.focusRing)}
        disabled={busy || (needsTurnstile && !turnstileToken)}
      >
        {busy ? "Изпращане…" : "Изпрати"}
      </button>

      <p className={cn(pub.bodySm, "leading-relaxed")}>
        Алтернативно можеш да пишеш директно на{" "}
        <a className={pub.linkInline} href={`mailto:${SITE_ADMIN_EMAIL}`}>
          {SITE_ADMIN_EMAIL}
        </a>
        . С изпращането приемаш обработката на данните според{" "}
        <Link href="/privacy" className={pub.linkInline}>
          политиката за поверителност
        </Link>
        .
      </p>
    </form>
  );
}
