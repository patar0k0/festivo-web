"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrganizerClaimMeResponse } from "@/app/api/organizer/claims/me/route";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";

type OrganizerSuggestion = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  verified: boolean;
};

const STEPS = [
  { n: 1, title: "Заявка", active: true },
  { n: 2, title: "Преглед", active: false },
  { n: 3, title: "Достъп", active: false },
] as const;

const POST_SUBMIT_INFO = [
  {
    icon: "📨",
    title: "Получаваш потвърждение",
    body: "Виждаш съобщение че заявката е приета и записана в опашката за преглед.",
  },
  {
    icon: "🔍",
    title: "Проверка от екипа",
    body: "Свързваме се с теб на имейла или телефона за да потвърдим, че имаш право върху профила (1–3 работни дни).",
  },
  {
    icon: "🎉",
    title: "Получаваш достъп",
    body: "След одобрение влизаш в таблото за организатори и можеш да управляваш профила и фестивалите.",
  },
] as const;

export default function OrganizerClaimPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrganizerSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<OrganizerSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const needsTurnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myClaim, setMyClaim] = useState<OrganizerClaimMeResponse | undefined>(undefined);

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }, []);

  // Load existing claim status
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/organizer/claims/me", { credentials: "include" });
        const payload = (await res.json().catch(() => null)) as
          | OrganizerClaimMeResponse
          | { error?: string }
          | null;
        if (
          res.ok &&
          payload &&
          typeof payload === "object" &&
          "status" in payload &&
          !("error" in payload)
        ) {
          setMyClaim(payload as OrganizerClaimMeResponse);
        } else {
          setMyClaim({ status: "none" });
        }
      } catch {
        setMyClaim({ status: "none" });
      }
    })();
  }, []);

  // Approved → redirect to organizer profile
  useEffect(() => {
    if (myClaim?.status === "approved" && myClaim.organizer_slug) {
      router.push(`/organizers/${myClaim.organizer_slug}`);
    }
  }, [myClaim, router]);

  // Debounced search
  useEffect(() => {
    if (selected) {
      setSuggestions([]);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        setSuggestions([]);
        setSearchLoading(true);
        try {
          const res = await fetch(`/api/organizer/search?q=${encodeURIComponent(q)}`, {
            signal: controller.signal,
          });
          const payload = (await res.json().catch(() => null)) as
            | { organizers?: OrganizerSuggestion[]; error?: string }
            | null;
          if (!res.ok) {
            setSuggestions([]);
            return;
          }
          setSuggestions(payload?.organizers ?? []);
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
          setSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 300);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, selected]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const slug = selected?.slug?.trim() ?? "";
    if (!slug) {
      setError("Избери организатор от списъка.");
      return;
    }
    const email = contactEmail.trim();
    const phone = contactPhone.trim();
    if (!email) {
      setError("Попълни имейл за връзка.");
      return;
    }
    if (!phone) {
      setError("Попълни телефон за връзка.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/organizer/claims", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          contact_email: email,
          contact_phone: phone,
          turnstileToken: needsTurnstile ? turnstileToken : "",
        }),
      });
      await res.json().catch(() => null);
      if (!res.ok) {
        setTurnstileToken("");
        turnstileRef.current?.reset();
        throw new Error("Request failed");
      }
      setSubmitted(true);
      try {
        const meRes = await fetch("/api/organizer/claims/me", { credentials: "include" });
        const mePayload = (await meRes.json().catch(() => null)) as
          | OrganizerClaimMeResponse
          | { error?: string }
          | null;
        if (
          meRes.ok &&
          mePayload &&
          typeof mePayload === "object" &&
          "status" in mePayload &&
          !("error" in mePayload)
        ) {
          setMyClaim(mePayload as OrganizerClaimMeResponse);
        }
      } catch {
        /* ignore refresh errors; local submitted state still applies */
      }
      router.refresh();
    } catch {
      setError("Възникна грешка. Опитай пак.");
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  function pickOrganizer(org: OrganizerSuggestion) {
    setSelected(org);
    setQuery("");
    setSuggestions([]);
    setDropdownOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setSuggestions([]);
  }

  const trimmed = query.trim();
  const showDropdown = dropdownOpen && !selected && trimmed.length >= 2;
  const showEmptyState = showDropdown && !searchLoading && suggestions.length === 0;

  const canSubmit =
    !loading &&
    !!selected &&
    contactEmail.trim().length > 0 &&
    contactPhone.trim().length > 0 &&
    (!needsTurnstile || turnstileToken.length > 0);

  // ── Status-specific full-page views ─────────────────────────────────
  const renderStatusBanner = () => {
    if (myClaim === undefined) {
      return (
        <div className="rounded-2xl border border-black/[0.06] bg-white/95 p-6 text-center shadow-sm md:p-8">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-[#7c2d12]" />
          <p className={cn(pub.bodySm, "mt-3")}>Зареждане на статуса…</p>
        </div>
      );
    }

    if (myClaim.status === "approved") {
      return (
        <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-sm md:p-8">
          <p className="text-3xl" aria-hidden="true">
            🎉
          </p>
          <h2 className={cn(pub.displayH1, "mt-3 text-xl md:text-2xl")}>
            Профилът е одобрен
          </h2>
          <p className={cn(pub.bodySm, "mt-2")}>
            Имаш достъп до организаторския профил. Можеш да добавяш и редактираш фестивали.
          </p>
          {myClaim.organizer_slug ? (
            <Link
              href={`/organizers/${myClaim.organizer_slug}`}
              className={cn(pub.btnPrimary, pub.focusRing, "mt-5")}
            >
              Отвори профила →
            </Link>
          ) : null}
        </div>
      );
    }

    if (submitted || myClaim.status === "pending") {
      return (
        <div className="rounded-2xl border border-amber-200/65 bg-gradient-to-br from-amber-50/70 to-white p-6 shadow-sm md:p-8">
          <p className="text-3xl" aria-hidden="true">
            ⏳
          </p>
          <h2 className={cn(pub.displayH1, "mt-3 text-xl md:text-2xl")}>
            Заявката е изпратена
          </h2>
          <p className={cn(pub.bodySm, "mt-2 max-w-prose")}>
            Получихме заявката ти и я добавихме в опашката за преглед. Свързваме се с
            теб обикновено в рамките на 1–3 работни дни.
          </p>
          <div className="mt-5 rounded-xl border border-amber-200/50 bg-white/60 p-4">
            <p className="text-xs font-semibold text-[#0c0e14]">Какво следва</p>
            <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-black/65">
              <li>1. Екипът проверява връзката ти с организацията</li>
              <li>2. При нужда се свързваме на посочения имейл/телефон</li>
              <li>3. След одобрение получаваш достъп и имейл уведомление</li>
            </ol>
          </div>
          <p className="mt-5 text-xs text-black/55">
            Въпроси?{" "}
            <a
              href="mailto:admin@festivo.bg"
              className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
            >
              admin@festivo.bg
            </a>
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={cn(pub.page, "min-h-screen")}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        {/* ── Back link ──────────────────────────────────────────────── */}
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

        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="mt-6">
          <p className={pub.eyebrowMuted}>Заявка за достъп</p>
          <h1 className={cn(pub.displayH1, "mt-3")}>Поеми съществуващ профил</h1>
          <p className={cn(pub.body, "mt-3 max-w-2xl")}>
            Организацията ти вече е в Festivo — заяви правото да я управляваш. Намери
            името, попълни контакти и екипът ще потвърди връзката с теб.
          </p>

          {/* Steps */}
          <ol
            className="mt-7 flex flex-wrap items-center gap-2 sm:gap-3"
            aria-label="Стъпки от заявката"
          >
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

        {/* ── If status is loading/approved/pending — show single banner ─ */}
        {myClaim === undefined ||
        myClaim.status === "approved" ||
        submitted ||
        myClaim.status === "pending" ? (
          <div className="mt-9">{renderStatusBanner()}</div>
        ) : (
          /* ── Form mode (status: none or rejected) ─────────────────── */
          <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
            {/* ─ LEFT: form ─ */}
            <div className="space-y-5">
              {myClaim.status === "rejected" ? (
                <div className="rounded-2xl border border-red-200/70 bg-red-50/70 px-5 py-4 text-sm text-red-900/90">
                  <p className="font-semibold">Предишната заявка е отхвърлена.</p>
                  <p className="mt-1 text-red-900/75">
                    Можеш да изпратиш нова, ако имаш право върху профила. При въпроси
                    пиши на admin@festivo.bg.
                  </p>
                </div>
              ) : null}

              <form
                onSubmit={onSubmit}
                className="space-y-7 rounded-2xl border border-amber-200/55 bg-white/95 p-5 shadow-sm md:p-7"
              >
                <input type="hidden" name="slug" value={selected?.slug ?? ""} readOnly />

                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-900/90"
                  >
                    {error}
                  </div>
                ) : null}

                {/* ── Section: Organizer ──────────────── */}
                <section className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-[#0c0e14]">Организатор</h2>
                    <p className="mt-1 text-xs text-black/55">
                      Намери името на организацията си по съществуващ запис в Festivo.
                    </p>
                  </div>

                  {selected ? (
                    <div>
                      <span className={pub.label}>Избран организатор</span>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-base font-bold text-[#7c2d12] ring-1 ring-emerald-200/60"
                          aria-hidden="true"
                        >
                          {selected.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#0c0e14]">
                            {selected.name}
                          </p>
                          {selected.verified ? (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                              <span aria-hidden="true">✓</span> Потвърден от Festivo
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-black/50">
                              festivo.bg/organizers/{selected.slug}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={clearSelection}
                          className={cn(pub.btnGhost, "shrink-0")}
                        >
                          Промени
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className={pub.label} htmlFor="organizer-search">
                        Търси организатор{" "}
                        <span className="text-[#7c2d12]" aria-label="задължително">
                          *
                        </span>
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="organizer-search"
                          type="search"
                          autoComplete="off"
                          value={query}
                          onChange={(ev) => {
                            setQuery(ev.target.value);
                            setDropdownOpen(true);
                          }}
                          onFocus={() => setDropdownOpen(true)}
                          onBlur={() => {
                            blurCloseTimer.current = setTimeout(
                              () => setDropdownOpen(false),
                              150,
                            );
                          }}
                          placeholder="напр. Община Банско"
                          className={cn(pub.input, "pl-9")}
                          aria-autocomplete="list"
                          aria-controls="organizer-search-listbox"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-black/35"
                        >
                          🔍
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-black/45">
                        Напиши поне 2 символа. Резултатите се показват автоматично.
                      </p>

                      {showDropdown ? (
                        <ul
                          id="organizer-search-listbox"
                          role="listbox"
                          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-black/[0.12] bg-white py-1 shadow-lg"
                        >
                          {searchLoading ? (
                            <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-black/55">
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/10 border-t-[#7c2d12]" />
                              Търсене…
                            </li>
                          ) : showEmptyState ? (
                            <li className="px-3 py-3 text-sm text-black/55" role="status">
                              <p className="font-medium text-black/65">
                                Няма намерени организатори за „{trimmed}&#8221;.
                              </p>
                              <p className="mt-1 text-xs">
                                Опитай с друго име, или{" "}
                                <Link
                                  href="/organizer/profile/new"
                                  className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
                                >
                                  създай нов профил
                                </Link>
                                .
                              </p>
                            </li>
                          ) : (
                            suggestions.map((org) => (
                              <li key={org.id} role="presentation">
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={false}
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[#0c0e14] transition-colors hover:bg-amber-50/80"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    clearBlurTimer();
                                  }}
                                  onClick={() => pickOrganizer(org)}
                                >
                                  <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-xs font-bold text-[#7c2d12]"
                                    aria-hidden="true"
                                  >
                                    {org.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{org.name}</span>
                                  {org.verified ? (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100">
                                      <span aria-hidden="true">✓</span>
                                      Потвърден
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </section>

                {/* ── Section: Contacts ──────────────── */}
                <section className="space-y-5 border-t border-black/[0.06] pt-7">
                  <div>
                    <h2 className="text-base font-semibold text-[#0c0e14]">Контакти за верификация</h2>
                    <p className="mt-1 text-xs text-black/55">
                      Не са публични — използват се само за да потвърдим връзката ти с
                      организацията.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="claim-contact-email" className={pub.label}>
                      Имейл за връзка{" "}
                      <span className="text-[#7c2d12]" aria-label="задължително">
                        *
                      </span>
                    </label>
                    <input
                      id="claim-contact-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={contactEmail}
                      onChange={(ev) => setContactEmail(ev.target.value)}
                      className={cn(pub.input, "mt-1.5")}
                      placeholder="ime@organisatziya.bg"
                      required
                    />
                    <p className="mt-1 text-[11px] text-black/45">
                      Препоръчваме фирмен/официален имейл — улеснява верификацията.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="claim-contact-phone" className={pub.label}>
                      Телефон за връзка{" "}
                      <span className="text-[#7c2d12]" aria-label="задължително">
                        *
                      </span>
                    </label>
                    <input
                      id="claim-contact-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={contactPhone}
                      onChange={(ev) => setContactPhone(ev.target.value)}
                      className={cn(pub.input, "mt-1.5")}
                      placeholder="+359 …"
                      required
                    />
                    <p className="mt-1 text-[11px] text-black/45">
                      🔒 Не се публикува — само за вътрешна верификация.
                    </p>
                  </div>
                </section>

                {/* ── Bot check ──────────────── */}
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

                {/* ── Submit ──────────────── */}
                <section className="border-t border-black/[0.06] pt-7">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c2d12] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-150",
                      "hover:bg-[#5c200d] active:scale-[0.99]",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      pub.focusRing,
                    )}
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Изпращане…
                      </>
                    ) : (
                      <>Заяви достъп →</>
                    )}
                  </button>

                  <p className="mt-3 text-center text-[11px] text-black/55">
                    С изпращане приемаш{" "}
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
            </div>

            {/* ─ RIGHT: info aside ─ */}
            <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
              {/* What happens next */}
              <div className="rounded-2xl border border-amber-200/55 bg-gradient-to-br from-amber-50/60 to-white/95 p-5 shadow-sm ring-1 ring-amber-100/40">
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

              {/* Not found? Create new */}
              <div className="rounded-2xl border border-emerald-200/55 bg-gradient-to-br from-emerald-50/45 to-white/95 p-5 shadow-sm ring-1 ring-emerald-100/35">
                <p className="text-xs font-semibold text-[#0c0e14]">Не намираш организацията си?</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-black/65">
                  Ако не съществува в Festivo, можеш да създадеш нов профил.
                </p>
                <Link
                  href="/organizer/profile/new"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0c3d2e] underline decoration-emerald-700/30 underline-offset-2 transition hover:decoration-[#0c3d2e]/60"
                >
                  Създай нов профил →
                </Link>
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
        )}
      </div>
    </div>
  );
}
