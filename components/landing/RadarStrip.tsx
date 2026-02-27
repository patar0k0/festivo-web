import Link from "next/link";

export type RadarEvent = {
  title: string;
  city: string;
  time: string;
  place: string;
  vibe: string;
  tags: string[];
  desc: string;
  slug?: string;
};

type Props = {
  events: RadarEvent[];
  activeTag: string;
  shownCount: number;
  onAdd: (event: RadarEvent) => void;
};

const vibeCoverClass: Record<string, string> = {
  Party: "landing-cover-party",
  Family: "landing-cover-family",
  "✨ Chill": "landing-cover-chill",
  Culture: "landing-cover-culture",
};

const vibeEmoji: Record<string, string> = {
  Party: "🎵",
  Family: "🏮",
  "✨ Chill": "🍜",
  Culture: "🌟",
};

export default function RadarStrip({ events, activeTag, shownCount, onAdd }: Props) {
  return (
    <section className="py-4" id="radar">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-black tracking-[-0.5px] text-[#0c0e14]">Festival Radar</h2>
            <p className="mt-0.5 text-[13px] text-black/50">Добавяй в план с едно кликване</p>
          </div>
          <Link
            href="/festivals"
            className="inline-flex h-[34px] items-center gap-1.5 rounded-[12px] border border-black/[0.1] bg-white px-4 text-xs font-bold shadow-[0_2px_0_rgba(12,14,20,0.06),0_8px_20px_rgba(12,14,20,0.06)] transition hover:border-black/20"
          >
            Виж всички →
          </Link>
        </div>

        {/* Horizontal scroll strip */}
        <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
          {events.length === 0 ? (
            <div className="flex min-h-[200px] w-full items-center justify-center rounded-[24px] border border-black/[0.08] bg-white text-sm text-black/50">
              Няма събития по текущия филтър.
            </div>
          ) : (
            events.map((event) => {
              const coverClass = vibeCoverClass[event.vibe] ?? "landing-cover-default";
              const emoji = vibeEmoji[event.vibe] ?? "🎪";

              return (
                <article
                  key={event.title}
                  className="relative flex min-w-[min(340px,86vw)] flex-1 flex-col overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_0_rgba(12,14,20,0.08),0_20px_48px_rgba(12,14,20,0.12)]"
                  style={{ scrollSnapAlign: "start" }}
                >
                  {/* Cover image area */}
                  <div className={`relative h-[156px] overflow-hidden ${coverClass}`}>
                    <div className="absolute inset-0 flex items-center justify-center text-[72px] opacity-20">
                      {emoji}
                    </div>
                    <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
                      {event.vibe}
                    </span>
                    <span className="absolute right-3 top-3 rounded-full bg-[#1a9e5c] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                      FREE
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-black/[0.08] bg-[#f5f4f0] px-2.5 py-1 text-[11px] font-bold text-black/50">
                        🏙 {event.city}
                      </span>
                      <span className="rounded-full border border-black/[0.08] bg-[#f5f4f0] px-2.5 py-1 text-[11px] font-bold text-black/50">
                        {event.time}
                      </span>
                    </div>

                    <h3 className="mb-1.5 text-[16px] font-extrabold leading-snug tracking-[-0.3px] text-[#0c0e14]">
                      {event.title}
                    </h3>
                    <p className="mb-4 flex-1 text-[12px] leading-relaxed text-black/55">{event.desc}</p>

                    <div className="flex items-center justify-between gap-2 border-t border-black/[0.07] pt-3">
                      <span className="text-[11px] font-semibold text-black/40">📍 {event.place}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onAdd(event)}
                          className="inline-flex h-[34px] items-center gap-1 rounded-[10px] border border-black/[0.1] bg-transparent px-3 text-[12px] font-extrabold transition hover:bg-[#f5f4f0] hover:border-black/20"
                        >
                          + В план
                        </button>
                        <Link
                          href={`/festival/${event.slug ?? "demo"}`}
                          className="inline-flex h-[34px] items-center gap-1 rounded-[10px] bg-[#ff4c1f] px-3 text-[12px] font-extrabold text-white transition hover:bg-[#e04010] hover:-translate-y-px"
                        >
                          Детайли
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="sr-only">Показани: {shownCount}</div>
      </div>
    </section>
  );
}
