import "@/app/landing.css";

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 2v3M16 2v3M3.5 9h17M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconMusic({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-5a3 3 0 11-6 0 3 3 0 016 0z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const teasers = [
  {
    icon: IconCalendar,
    title: "Календар и дати",
    text: "Планирай уикендите около реални събития.",
  },
  {
    icon: IconMap,
    title: "Карта",
    text: "Виж къде се случва всичко в България.",
  },
  {
    icon: IconMusic,
    title: "Фестивали",
    text: "От фолклор до градски формати — на едно място.",
  },
] as const;

export default function ComingSoonPublic() {
  return (
    <div className="landing-bg relative isolate overflow-hidden text-[#0c0e14]">
      {/* Фонови акценти */}
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[#ff4c1f]/[0.07] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/3 h-[360px] w-[360px] rounded-full bg-[#1a9e5c]/[0.08] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[280px] w-[min(100%,720px)] -translate-x-1/2 translate-y-1/3 rounded-[100%] bg-[#c4b8a8]/[0.25] blur-3xl"
        aria-hidden
      />

      <main className="relative mx-auto flex min-h-[min(88vh,820px)] max-w-3xl flex-col justify-center px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center">
          <div className="mx-auto flex max-w-md justify-center gap-3 sm:gap-4">
            {teasers.map(({ icon: Icon, title }) => (
              <div
                key={title}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/90 text-[#ff4c1f] shadow-[0_2px_0_rgba(12,14,20,0.04)] sm:h-14 sm:w-14"
              >
                <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-[28px] border border-black/[0.08] bg-white/[0.92] px-8 py-10 shadow-[0_2px_0_rgba(12,14,20,0.05),0_24px_56px_rgba(12,14,20,0.09)] backdrop-blur-md sm:px-12 sm:py-12">
            <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-gradient-to-r from-[#ff4c1f] to-[#1a9e5c]" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Festivo</p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-[1.12] tracking-tight sm:text-4xl md:text-[2.75rem]">
              Очаквайте скоро
            </h1>
            <p className="mx-auto mt-5 max-w-md text-pretty text-[15px] leading-relaxed text-black/60 sm:text-base">
              Работим по новото изживяване за откриване на фестивали в България — по-ясно, по-удобно и по-близо до
              хората.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-black/[0.08] bg-black/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
                Безплатни събития
              </span>
              <span className="rounded-full border border-black/[0.08] bg-black/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
                Скоро онлайн
              </span>
            </div>
          </div>
        </div>

        <ul className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-5">
          {teasers.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="rounded-2xl border border-black/[0.06] bg-white/55 px-4 py-4 text-center shadow-[0_1px_0_rgba(12,14,20,0.04)] backdrop-blur-sm sm:text-left"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff4c1f]/[0.09] text-[#ff4c1f] sm:mx-0">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-[#0c0e14]">{title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-black/55">{text}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
