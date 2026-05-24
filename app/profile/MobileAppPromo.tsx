"use client";

import { FormEvent, useState } from "react";

type Props = {
  /** Pre-fill the notify form with the user's account email (server-passed). */
  defaultEmail: string | null;
};

const FEATURES = [
  { icon: "🔔", title: "Push известия", desc: "За запазените ти фестивали" },
  { icon: "🗺️", title: "Офлайн карта", desc: "Без интернет на терен" },
  { icon: "⚡", title: "По-бързо", desc: "Native UX, swipe навигация" },
];

export default function MobileAppPromo({ defaultEmail }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
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
          source: "mobile_waitlist",
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
    } catch {
      setError("Мрежова грешка. Опитай отново.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-amber-200/50 bg-gradient-to-br from-[#fef9f1] via-white to-[#fef3e2] p-5 md:p-7"
      aria-labelledby="mobile-app-promo-title"
    >
      {/* Decorative accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#7c2d12]/10 blur-2xl"
      />

      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c2d12]">
          Скоро
        </p>
        <h2
          id="mobile-app-promo-title"
          className="mt-1 text-xl font-semibold tracking-tight text-[#0c0e14] md:text-2xl"
        >
          Festivo на мобилния ти телефон
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-black/65">
          Получаваш push известия преди фестивал, офлайн карта и личен feed с
          препоръки. Известяваме те когато приложението е готово в App Store и
          Google Play.
        </p>

        {/* Feature bullets */}
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="flex items-start gap-2.5 rounded-xl border border-black/[0.06] bg-white/70 p-3"
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {f.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0c0e14]">{f.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-black/55">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Notify-me form */}
        {!ok ? (
          <form onSubmit={onSubmit} className="relative mt-5" noValidate>
            {/* Honeypot */}
            <div
              className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
              aria-hidden="true"
            >
              <label htmlFor="mobile-promo-website">Website</label>
              <input
                id="mobile-promo-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(ev) => setHoneypot(ev.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="mobile-promo-email" className="sr-only">
                  Имейл адрес
                </label>
                <input
                  id="mobile-promo-email"
                  name="email"
                  type="email"
                  required
                  maxLength={320}
                  placeholder="твоят@имейл.bg"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2.5 text-sm text-[#0c0e14] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-black/20"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1f1f23] active:scale-[0.99] disabled:opacity-50 sm:min-w-[160px]"
              >
                {busy ? "Записва…" : "Известете ме"}
              </button>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-xs text-red-900/90"
              >
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="mt-5 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900/90">
            ✓ Записахме те. Ще получиш имейл когато приложението е готово.
          </p>
        )}

        {/* Store badges (placeholder until apps are live) */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <StoreBadge label="App Store" icon="" />
          <StoreBadge label="Google Play" icon="▶" />
          <span className="text-[11px] text-black/45">— очаквайте ден 21+</span>
        </div>
      </div>
    </section>
  );
}

function StoreBadge({ label, icon }: { label: string; icon: string }) {
  return (
    <span
      aria-disabled="true"
      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white/60 px-3 py-1.5 text-xs font-medium text-black/40"
      title="Скоро в магазина"
    >
      {icon ? (
        <span className="text-sm" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}
