/**
 * Shared public UI class maps — design language aligned with `/organizer/claim`
 * (warm amber borders, ink text, primary CTA #7c2d12, rounded-2xl shells).
 * Import `pub` and merge with `cn()` where needed.
 */
export const pub = {
  /** Page shell (background comes from root `body.landing-bg`) */
  page: "text-[#0c0e14]",
  pageOverflow: "overflow-x-hidden text-[#0c0e14]",

  /** Layout */
  container: "mx-auto max-w-6xl px-4",
  containerNarrow: "mx-auto max-w-lg px-4 md:px-6",

  section: "overflow-x-clip bg-transparent py-8 md:py-10",
  sectionLoose: "overflow-x-clip bg-transparent pb-8 pt-8 md:pb-10 md:pt-10",

  stackLg: "space-y-7 lg:space-y-8",
  stackMd: "space-y-6 lg:space-y-7",

  /** Focus — warm primary, not marketing orange */
  focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25",

  /** Intro / hero panel (claim-style warm card) */
  panelHero:
    "rounded-2xl border border-amber-200/65 bg-gradient-to-br from-amber-50/92 via-white/95 to-white/88 p-5 shadow-sm ring-1 ring-amber-100/45 backdrop-blur md:p-7",

  /** Toolbar / stats strip */
  panel:
    "rounded-2xl border border-amber-200/38 bg-white/92 p-4 shadow-sm backdrop-blur md:p-5",

  /** Neutral elevated blocks (map shell, results) */
  panelMuted:
    "rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] ring-1 ring-amber-100/25 backdrop-blur",

  /** Section heading bar (organizer festivals, etc.) */
  panelAccentBar:
    "relative rounded-2xl border border-amber-200/45 bg-white/90 py-1 pl-5 pr-2 shadow-sm ring-1 ring-amber-100/35 md:pl-6",

  /** Primary content sections (festival detail) */
  sectionCard:
    "rounded-2xl border border-amber-200/30 bg-white/90 shadow-[0_2px_0_rgba(12,14,20,0.04),0_8px_22px_rgba(12,14,20,0.06)] ring-1 ring-amber-100/20 transition-all duration-200 hover:-translate-y-px hover:shadow-md",

  sectionCardSoft:
    "rounded-2xl border border-black/[0.08] bg-white/80 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)] transition-all duration-200 hover:-translate-y-px hover:shadow-md",

  /** Festival detail hero wrap */
  heroMainCard:
    "overflow-hidden rounded-2xl border border-amber-200/45 bg-white shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_32px_rgba(12,14,20,0.08)] ring-1 ring-amber-100/35 transition-all duration-200 hover:shadow-md",

  /** Sticky rail cards */
  railCard:
    "rounded-2xl border border-amber-200/35 bg-gradient-to-b from-amber-50/45 to-white/95 p-5 shadow-sm ring-1 ring-amber-100/30 transition-all duration-200 hover:-translate-y-px hover:shadow-md",

  railCardPlain:
    "rounded-2xl border border-amber-200/32 bg-white/92 p-5 shadow-sm ring-1 ring-amber-100/25 transition-all duration-200 hover:-translate-y-px hover:shadow-md",

  /** Quick facts strip */
  factsStrip:
    "rounded-2xl border border-amber-200/25 bg-gradient-to-b from-white to-[#faf9f6] px-4 py-3.5 ring-1 ring-amber-100/20 transition-all duration-200 hover:-translate-y-px hover:shadow-md sm:px-5",

  /** Typography */
  eyebrow: "text-xs font-semibold uppercase tracking-[0.14em] text-amber-900/50",

  eyebrowMuted: "text-xs font-semibold uppercase tracking-[0.2em] text-black/40",

  displayH1: "font-[var(--font-display)] text-3xl font-bold tracking-tight text-[#0c0e14] md:text-4xl",

  pageTitle: "text-3xl font-bold tracking-tight text-[#0c0e14] md:text-4xl",

  sectionTitle: "text-xl font-medium text-black/90",

  sectionTitleMd: "text-lg font-medium text-black/90",

  body: "text-sm text-black/65 md:text-[15px]",

  bodySm: "text-sm text-black/60",

  label: "block text-sm font-medium text-[#0c0e14]",

  caption: "text-xs text-black/60",

  dtLabel: "text-xs font-semibold uppercase tracking-[0.14em] text-black/60",

  /** Context notice (e.g. filtered city) */
  noticeWarm:
    "rounded-2xl border border-amber-200/55 bg-amber-50/85 px-5 py-3 text-sm font-semibold text-[#5c200d] md:px-6",

  /** Buttons */
  btnPrimary:
    "inline-flex items-center justify-center rounded-xl bg-[#7c2d12] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] hover:opacity-[0.97] active:scale-[0.98] disabled:opacity-50",

  btnPrimaryFull:
    "w-full rounded-xl bg-[#7c2d12] py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] hover:opacity-[0.97] active:scale-[0.98] disabled:opacity-50",

  btnPrimarySm:
    "inline-flex items-center justify-center rounded-xl bg-[#7c2d12] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] hover:opacity-[0.97] active:scale-[0.98] disabled:opacity-50",

  btnSecondary:
    "inline-flex items-center justify-center rounded-xl border border-black/[0.1] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0e14] transition-all duration-150 hover:bg-black/[0.04] active:scale-[0.98]",

  btnSecondarySm:
    "inline-flex items-center justify-center rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition-all duration-150 hover:bg-black/[0.04] active:scale-[0.98]",

  btnGhost:
    "rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[#0c0e14] transition-all duration-150 hover:bg-black/[0.04] hover:opacity-95 active:scale-[0.98]",

  /** Chips — filter / nav */
  chip:
    "rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition-all duration-150 hover:border-black/20 hover:bg-white active:scale-[0.98]",

  chipActive:
    "rounded-full border border-[#7c2d12] bg-[#7c2d12] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all duration-150 hover:bg-[#5c200d] hover:opacity-[0.98] active:scale-[0.98]",

  chipSm:
    "rounded-full border border-black/[0.1] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition-all duration-150 hover:border-black/20 hover:bg-[#f8f7f4] active:scale-[0.98]",

  /** Toggle row (program days, reminders) */
  toggleInactive:
    "border-black/[0.1] bg-white text-[#0c0e14] transition-all duration-150 hover:border-black/20 hover:bg-black/[0.04] active:scale-[0.98]",

  toggleActive:
    "border-[#7c2d12] bg-[#7c2d12] text-white transition-all duration-150 hover:bg-[#5c200d] hover:opacity-[0.98] active:scale-[0.98]",

  /** Form controls */
  input:
    "w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm text-[#0c0e14] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-black/20",

  inputSearch:
    "w-full border border-black/[0.1] bg-white/95 text-[#0c0e14] shadow-[0_1px_0_rgba(12,14,20,0.04)] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-black/20",

  /** Festival listing card shell */
  festivalCard:
    "group flex h-full flex-col overflow-hidden rounded-2xl border border-amber-200/35 bg-white/92 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_28px_rgba(12,14,20,0.07)] ring-1 ring-amber-100/25 transition-all duration-200 hover:-translate-y-px hover:border-amber-300/50 hover:shadow-md focus-within:-translate-y-px focus-within:border-amber-300/50 focus-within:shadow-md",

  festivalCardImageLink:
    "group/image absolute inset-0 block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/40 focus-visible:ring-offset-2",

  dateBadge:
    "pointer-events-none absolute left-4 top-4 rounded-lg bg-[#7c2d12] px-3 py-2 text-center text-white shadow-sm",

  metaChip:
    "pointer-events-none absolute right-4 top-4 rounded-full border border-amber-200/60 bg-white/95 px-3 py-1 text-xs font-semibold text-[#0c0e14]/80 backdrop-blur",

  programItemCard:
    "rounded-xl border border-amber-200/25 bg-white p-4 shadow-[0_2px_0_rgba(12,14,20,0.03),0_6px_14px_rgba(12,14,20,0.05)] transition-all duration-200 hover:-translate-y-px hover:shadow-md",

  linkInline:
    "font-semibold text-[#0c0e14] underline decoration-black/25 underline-offset-2 hover:decoration-black/50",

  /** Map / list selection */
  selectionRing: "ring-2 ring-[#7c2d12]/35",

  /** Checkbox accent (calendar filters) */
  checkboxAccent: "h-4 w-4 rounded border-black/25 text-[#7c2d12] focus:ring-[#7c2d12]/30",
} as const;

export type PublicUiClassKey = keyof typeof pub;
