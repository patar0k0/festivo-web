"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
import OrganizerProfilePreview from "./OrganizerProfilePreview";

// Field limits — kept generous since DB validation is loose; these guide users
// to write concise, well-shaped content (and prevent accidental paste of huge text).
const NAME_MAX = 120;
const DESC_MAX = 400;
const URL_MAX = 500;
const EMAIL_MAX = 320;

const STEPS = [
  { n: 1, title: "Профил", active: true, done: false },
  { n: 2, title: "Одобрение", active: false, done: false },
  { n: 3, title: "Първи фестивал", active: false, done: false },
] as const;

const POST_SUBMIT_INFO = [
  {
    icon: "📨",
    title: "Получаваш потвърждение",
    body: "Веднага след създаването виждаш потвърждение и линк към таблото си.",
  },
  {
    icon: "⏱️",
    title: "Одобрение от модератор",
    body: "Екипът проверява профила (обикновено 1–3 работни дни) и потвърждава по имейл.",
  },
  {
    icon: "🎉",
    title: "Готов си за фестивали",
    body: "След одобрение можеш да публикуваш първия си фестивал — той също минава кратък преглед.",
  },
] as const;

export default function NewOrganizerProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const needsTurnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/organizers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          website_url: websiteUrl || null,
          email: email || null,
          turnstileToken: needsTurnstile ? turnstileToken : "",
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setTurnstileToken("");
        turnstileRef.current?.reset();
        throw new Error(payload?.error ?? "Грешка при създаване.");
      }
      router.push("/organizer/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспех.");
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length > 0 && (!needsTurnstile || turnstileToken.length > 0) && !busy;

  return (
    <div className={cn(pub.page, "min-h-screen")}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href="/organizer"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-black/55 transition-colors hover:text-[#0c0e14]",
            pub.focusRing,
            "rounded-sm",
          )}
        >
          <span aria-hidden="true">←</span> Назад към „За организатори&#8221;
        </Link>

        {/* ── Header + steps ────────────────────────────────────────── */}
        <header className="mt-6">
          <p className={pub.eyebrowMuted}>Регистрация на организатор</p>
          <h1 className={cn(pub.displayH1, "mt-3")}>Създай нов профил</h1>
          <p className={cn(pub.body, "mt-3 max-w-2xl")}>
            Регистрирай организацията си в Festivo. След създаване, профилът минава преглед
            от екипа (1–3 работни дни) и получаваш достъп до таблото си.
          </p>

          {/* Step indicator */}
          <ol className="mt-7 flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Стъпки от регистрацията">
            {STEPS.map((s, idx) => {
              const isActive = s.active;
              return (
                <li
                  key={s.n}
                  className="flex items-center gap-2 sm:gap-3"
                  aria-current={isActive ? "step" : undefined}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isActive
                        ? "bg-[#7c2d12] text-white shadow-sm"
                        : "border border-black/[0.15] bg-white text-black/45",
                    )}
                    aria-hidden="true"
                  >
                    {s.n}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold sm:text-sm",
                      isActive ? "text-[#0c0e14]" : "text-black/45",
                    )}
                  >
                    {s.title}
                  </span>
                  {idx < STEPS.length - 1 ? (
                    <span aria-hidden="true" className="hidden h-px w-8 bg-black/15 sm:block" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </header>

        {/* ── Main grid: form (left) + preview/info (right) ───────────── */}
        <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
          {/* ─ LEFT: form ─ */}
          <form
            onSubmit={onSubmit}
            className="space-y-7 rounded-2xl border border-emerald-200/45 bg-white/95 p-5 shadow-sm md:p-7"
          >
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-900/90"
              >
                {error}
              </div>
            ) : null}

            {/* ── Section: Идентичност ─────────────── */}
            <section className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-[#0c0e14]">Идентичност</h2>
                <p className="mt-1 text-xs text-black/55">
                  Това виждат посетителите. Избери ясно, разпознаваемо име.
                </p>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="org-name" className={pub.label}>
                  Име на организатора{" "}
                  <span className="text-[#7c2d12]" aria-label="задължително">
                    *
                  </span>
                </label>
                <input
                  id="org-name"
                  required
                  maxLength={NAME_MAX}
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  placeholder="напр. Община Копривщица"
                  className={cn(pub.input, "mt-1.5")}
                  autoComplete="organization"
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-black/45">
                  <span>Юридическо лице, община, асоциация или личен бранд.</span>
                  <span className={name.length > NAME_MAX * 0.85 ? "text-amber-700" : ""}>
                    {name.length}/{NAME_MAX}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="org-description" className={pub.label}>
                  Кратко описание
                </label>
                <textarea
                  id="org-description"
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                  rows={4}
                  maxLength={DESC_MAX}
                  placeholder="Кои сте, какви фестивали организирате, от колко време…"
                  className={cn(pub.input, "mt-1.5 min-h-[6.5rem] resize-y")}
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-black/45">
                  <span>2–3 изречения работят най-добре.</span>
                  <span className={description.length > DESC_MAX * 0.85 ? "text-amber-700" : ""}>
                    {description.length}/{DESC_MAX}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Section: Контакти ─────────────── */}
            <section className="space-y-5 border-t border-black/[0.06] pt-7">
              <div>
                <h2 className="text-base font-semibold text-[#0c0e14]">Контакти</h2>
                <p className="mt-1 text-xs text-black/55">
                  По избор. Тези данни са публично видими — посетителите ще могат да се
                  свържат с теб.
                </p>
              </div>

              {/* Website */}
              <div>
                <label htmlFor="org-website" className={pub.label}>
                  Уебсайт
                </label>
                <input
                  id="org-website"
                  type="url"
                  value={websiteUrl}
                  onChange={(ev) => setWebsiteUrl(ev.target.value)}
                  maxLength={URL_MAX}
                  placeholder="https://"
                  className={cn(pub.input, "mt-1.5")}
                  autoComplete="url"
                  inputMode="url"
                />
                <p className="mt-1 text-[11px] text-black/45">
                  Официален сайт, страница във Facebook или Instagram — каквото имаш.
                </p>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="org-email" className={pub.label}>
                  Имейл за контакт
                </label>
                <input
                  id="org-email"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  maxLength={EMAIL_MAX}
                  placeholder="contact@example.bg"
                  className={cn(pub.input, "mt-1.5")}
                  autoComplete="email"
                  inputMode="email"
                />
                <p className="mt-1 text-[11px] text-black/45">
                  ⚠️ Видим е публично. Препоръчваме фирмен/споделен адрес, не личен.
                </p>
              </div>
            </section>

            {/* ── Section: Защита ─────────────── */}
            {needsTurnstile ? (
              <section className="border-t border-black/[0.06] pt-7">
                <div className="rounded-xl border border-black/[0.06] bg-[#fafaf8] p-4">
                  <p className="text-xs font-semibold text-black/60">Проверка срещу ботове</p>
                  <div className="mt-3">
                    <TurnstileWidget
                      ref={turnstileRef}
                      onSuccess={setTurnstileToken}
                      onError={() => setTurnstileToken("")}
                      onExpire={() => setTurnstileToken("")}
                      className="flex min-h-[65px] justify-start"
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {/* ── Submit ─────────────── */}
            <section className="border-t border-black/[0.06] pt-7">
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c3d2e] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-150",
                  "hover:bg-[#052e22] active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  pub.focusRing,
                )}
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Създаване…
                  </>
                ) : (
                  <>Създай организаторски профил →</>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] text-black/50">
                С натискане приемаш{" "}
                <Link
                  href="/terms-organizers"
                  className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
                >
                  Условията за организатори
                </Link>{" "}
                и{" "}
                <Link
                  href="/privacy"
                  className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
                >
                  Политиката за поверителност
                </Link>
                .
              </p>
            </section>
          </form>

          {/* ─ RIGHT: live preview + info ─ */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {/* Live preview */}
            <div>
              <p className={cn(pub.eyebrowMuted, "mb-3")}>Преглед на профила</p>
              <OrganizerProfilePreview
                name={name}
                description={description}
                websiteUrl={websiteUrl}
                email={email}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-black/45">
                Това е как ще изглежда профилът ти за посетителите след одобрение.
              </p>
            </div>

            {/* What happens next */}
            <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/60 to-white/95 p-5 shadow-sm ring-1 ring-amber-100/40">
              <p className={pub.eyebrowMuted}>Какво следва</p>
              <ol className="mt-4 space-y-3">
                {POST_SUBMIT_INFO.map((item, i) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-base ring-1 ring-amber-200/60"
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0c0e14]">
                        {i + 1}. {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-black/65">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Help */}
            <div className="rounded-2xl border border-black/[0.06] bg-white/95 p-5 shadow-sm">
              <p className="text-xs font-semibold text-[#0c0e14]">Имаш въпроси?</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-black/60">
                Пиши на{" "}
                <a
                  href="mailto:admin@festivo.bg"
                  className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
                >
                  admin@festivo.bg
                </a>
                . Отговаряме обикновено в рамките на 24 часа.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
