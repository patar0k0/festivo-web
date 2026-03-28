"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { cn } from "@/lib/utils";
import {
  FILTER_CHIPS,
  MOCK_CITIES,
  MOCK_FESTIVALS,
  type FilterId,
  type MockFestival,
} from "./testVisualMock";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function DeadLink({
  className,
  children,
  onClick,
  ...rest
}: Omit<ComponentPropsWithoutRef<"a">, "href">) {
  return (
    <a
      href="#"
      className={className}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
      }}
    >
      {children}
    </a>
  );
}

function applyFilters(
  items: MockFestival[],
  filter: FilterId,
  query: string,
): MockFestival[] {
  let out = items;
  const q = query.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.city.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }
  if (filter === "free") out = out.filter((f) => f.free);
  if (filter === "weekend") out = out.filter((f) => f.weekend);
  if (filter === "music") out = out.filter((f) => f.category === "Музика");
  return out;
}

function DemoCard({ festival }: { festival: MockFestival }) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white",
        "shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08)]",
        "transition duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(79,70,229,0.12)]",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={festival.image}
          alt=""
          fill
          className="object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
          aria-hidden
        />
        {festival.free ? (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white shadow-sm">
            Безплатно
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5 p-4 md:p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-600">
          {festival.category}
        </p>
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-[#0c0e14] md:text-xl">
          {festival.title}
        </h3>
        <p className="text-sm text-black/55">
          {festival.city} · {festival.dateLabel}
        </p>
        <DeadLink className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-violet-700 underline-offset-4 hover:text-violet-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50">
          Детайли
          <span aria-hidden>→</span>
        </DeadLink>
      </div>
    </article>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-600/90">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#0c0e14] md:text-3xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export default function TestVisualPrototype() {
  const [scrolled, setScrolled] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [pickedCity, setPickedCity] = useState<string | null>(null);
  const [geoPhase, setGeoPhase] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const cityWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!cityOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (cityWrapRef.current?.contains(t)) return;
      setCityOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCityOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [cityOpen]);

  useEffect(() => {
    if (geoPhase !== "done") return;
    const t = window.setTimeout(() => setGeoPhase("idle"), 3200);
    return () => window.clearTimeout(t);
  }, [geoPhase]);

  const upcoming = useMemo(
    () => applyFilters(MOCK_FESTIVALS, filter, search),
    [filter, search],
  );

  const weekendPick = useMemo(
    () =>
      applyFilters(
        MOCK_FESTIVALS.filter((f) => f.weekend),
        filter,
        search,
      ),
    [filter, search],
  );

  const onNearMe = useCallback(() => {
    if (geoPhase === "loading") return;
    setGeoPhase("loading");
    window.setTimeout(() => setGeoPhase("done"), 1400);
  }, [geoPhase]);

  const navBtn =
    "rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40";

  return (
    <div
      className="test-sandbox-shell landing-bg relative min-h-screen overflow-x-hidden pb-28 text-slate-100 md:pb-12"
      data-home-sandbox
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute -right-16 top-32 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute bottom-32 left-1/4 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
      </div>

      <a
        href="#main"
        className="absolute left-[-9999px] top-0 z-[100] rounded-lg bg-white px-4 py-2 text-sm text-[#0c0e14] shadow-lg focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        Към съдържанието
      </a>

      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-[background,backdrop-filter,border-color] duration-300",
          scrolled
            ? "border-white/[0.08] bg-[#07070c]/80 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <DeadLink className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white shadow-lg shadow-violet-500/25">
              F
            </span>
            Festivo
          </DeadLink>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Секции"
          >
            <button type="button" className={navBtn} onClick={() => scrollToId("discover")}>
              Открий
            </button>
            <button type="button" className={navBtn} onClick={() => scrollToId("upcoming")}>
              Предстоящи
            </button>
            <button type="button" className={navBtn} onClick={() => scrollToId("weekend")}>
              Уикенд
            </button>
            <button type="button" className={navBtn} onClick={() => scrollToId("cities")}>
              Градове
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <DeadLink className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/10 sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40">
              Вход
            </DeadLink>
            <DeadLink className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50">
              Абонирай се
            </DeadLink>
          </div>
        </div>
      </header>

      <main id="main" className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <p
          className="mb-8 mt-6 rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 text-center text-[11px] leading-relaxed text-slate-400 backdrop-blur-md md:mt-8"
          role="status"
        >
          Визуален прототип (/test) — линковете са демо (
          <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-200">
            #
          </code>
          ). Търсенето и филтрите работят локално върху примерни данни.
        </p>

        <section
          id="discover"
          className="relative scroll-mt-28 overflow-hidden rounded-[2rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.12] to-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-10"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-400/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 left-8 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" aria-hidden />

          <div className="relative grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-violet-400" />
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-violet-200/90">
                  Каталог · демо
                </p>
              </div>
              <h1 className="mt-4 text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-white md:text-4xl lg:text-[2.65rem]">
                Фестивали и събития — модерен изглед
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300/95">
                Професионален UI с търсене, филтри и навигация по секции. Без
                връзка към реални маршрути — само за презентация и UX тестове.
              </p>

              <label className="mt-8 block text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                Търсене в примерите
                <span className="mt-2 flex items-center gap-2 rounded-2xl border border-white/12 bg-black/20 px-4 py-3 backdrop-blur-md">
                  <span className="text-slate-500" aria-hidden>
                    ⌕
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Заглавие, град, категория…"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    autoComplete="off"
                  />
                </span>
              </label>

              <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Филтри">
                {FILTER_CHIPS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFilter(c.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition",
                      filter === c.id
                        ? "border-violet-400/50 bg-violet-500/25 text-violet-50 shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"
                        : "border-white/12 bg-white/[0.06] text-slate-200 hover:border-white/22 hover:bg-white/10",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Показатели
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                  180+
                </p>
                <p className="text-sm text-slate-400">събития в каталога</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Покритие
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                  24
                </p>
                <p className="text-sm text-slate-400">града и региона</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 backdrop-blur-md sm:col-span-2 lg:col-span-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                  Качество
                </p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-100/90">
                  Модерация и проверени източници — етикетът се отнася за продукта;
                  тук е визуален акцент.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-10 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-stretch">
            <button
              type="button"
              onClick={onNearMe}
              disabled={geoPhase === "loading"}
              className={cn(
                "rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 px-5 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.1em] text-white shadow-[0_8px_32px_rgba(139,92,246,0.35)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50",
                geoPhase === "loading" && "cursor-wait opacity-90",
              )}
            >
              {geoPhase === "loading" ? "Търсене около теб…" : "Около мен"}
            </button>

            <div className="relative" ref={cityWrapRef}>
              <button
                type="button"
                aria-expanded={cityOpen}
                aria-haspopup="menu"
                aria-controls="test-city-menu"
                onClick={() => setCityOpen((o) => !o)}
                className="flex h-full min-h-[48px] w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-100 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35 sm:min-w-[9.5rem]"
              >
                Избери град
              </button>
              {cityOpen ? (
                <ul
                  id="test-city-menu"
                  role="menu"
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-56 overflow-auto rounded-2xl border border-white/12 bg-[#121018]/95 py-2 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-0 sm:min-w-[14rem]"
                >
                  {MOCK_CITIES.map((city) => (
                    <li key={city} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-4 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                        onClick={() => {
                          setPickedCity(city);
                          setCityOpen(false);
                        }}
                      >
                        {city}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => scrollToId("upcoming")}
              className="rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-100 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
            >
              Към списъка
            </button>
          </div>
        </section>

        {pickedCity ? (
          <section
            className="mt-6 rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/10 px-5 py-3.5 text-sm text-violet-100 shadow-lg shadow-violet-950/25 backdrop-blur-sm"
            aria-live="polite"
          >
            Избран град (демо):{" "}
            <span className="font-semibold text-white">{pickedCity}</span>
          </section>
        ) : null}

        {geoPhase === "done" ? (
          <div
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-emerald-400/30 bg-emerald-950/90 px-5 py-3 text-sm text-emerald-50 shadow-2xl backdrop-blur-md md:bottom-8"
            role="status"
          >
            Готово — демо локация (без реални координати).
          </div>
        ) : null}

        <section
          id="upcoming"
          className="scroll-mt-28 pt-14 md:pt-20"
        >
          <div className="rounded-[1.75rem] border border-white/[0.07] bg-slate-50/[0.97] p-6 text-[#0c0e14] shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_24px_64px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] backdrop-blur-xl md:p-8">
            <SectionHeader
              eyebrow="Списък"
              title="Предстоящи"
              action={
                <DeadLink className="inline-flex rounded-full border border-[#0c0e14]/10 bg-white px-5 py-2.5 text-xs font-semibold text-[#0c0e14] shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40">
                  Виж всички
                </DeadLink>
              }
            />
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#0c0e14]/15 bg-white/70 px-6 py-14 text-center">
                <p className="text-sm text-black/55">Няма резултати за този филтър.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                  className="mt-4 text-sm font-semibold text-violet-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                >
                  Нулирай филтрите
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((f) => (
                  <DemoCard key={f.id} festival={f} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="weekend" className="scroll-mt-28 pt-10 md:pt-14">
          <div className="rounded-[1.75rem] border border-white/[0.07] bg-slate-50/[0.97] p-6 text-[#0c0e14] shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_24px_64px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] backdrop-blur-xl md:p-8">
            <SectionHeader
              eyebrow="Уикенд"
              title="Акценти за свободните дни"
              action={
                <DeadLink className="inline-flex rounded-full border border-[#0c0e14]/10 bg-white px-5 py-2.5 text-xs font-semibold text-[#0c0e14] shadow-sm transition hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40">
                  Календар
                </DeadLink>
              }
            />
            {weekendPick.length === 0 ? (
              <p className="text-sm text-black/55">Няма уикенд примери за този филтър.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {weekendPick.map((f) => (
                  <DemoCard key={`w-${f.id}`} festival={f} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="cities" className="scroll-mt-28 py-14 md:py-20">
          <div className="rounded-[1.75rem] border border-white/[0.07] bg-slate-50/[0.97] p-6 text-[#0c0e14] shadow-[0_24px_64px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.04] backdrop-blur-xl md:p-8">
            <SectionHeader eyebrow="Локации" title="Градове" />
            <div className="flex flex-wrap gap-2.5">
              {MOCK_CITIES.map((city) => (
                <DeadLink
                  key={city}
                  className="rounded-full border border-[#0c0e14]/8 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#0c0e14] shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                >
                  {city}
                </DeadLink>
              ))}
            </div>
          </div>

          <footer className="mt-12 border-t border-white/[0.08] pt-10 text-center text-xs text-slate-500">
            <DeadLink className="font-medium text-slate-400 hover:text-slate-200">
              Политика за поверителност
            </DeadLink>
            <span className="mx-2 text-slate-600" aria-hidden>
              ·
            </span>
            <DeadLink className="font-medium text-slate-400 hover:text-slate-200">
              Условия
            </DeadLink>
            <p className="mt-4 text-[11px] text-slate-600">
              © {new Date().getFullYear()} Festivo — визуален прототип
            </p>
          </footer>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-zinc-950/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden">
        <button
          type="button"
          onClick={onNearMe}
          disabled={geoPhase === "loading"}
          className={cn(
            "block w-full rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.1em] text-white shadow-lg shadow-violet-500/30",
            geoPhase === "loading" && "opacity-90",
          )}
        >
          {geoPhase === "loading" ? "Търсене…" : "Около мен"}
        </button>
      </div>
    </div>
  );
}
