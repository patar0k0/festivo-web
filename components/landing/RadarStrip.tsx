import Link from "next/link";

type RadarEvent = {
  title: string;
  city: string;
  time: string;
  place: string;
  vibe: string;
  tags: string[];
  desc: string;
};

type Props = {
  events: RadarEvent[];
  activeTag: string;
  shownCount: number;
  onAdd: (event: RadarEvent) => void;
};

const chipClass =
  "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]";

const badgeClass =
  "inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-black text-emerald-900";

const buttonClass =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold shadow-[0_6px_18px_rgba(12,18,32,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white/90";

export default function RadarStrip({ events, activeTag, shownCount, onAdd }: Props) {
  return (
    <section className="py-4" id="radar">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Festival Radar</h2>
            <p className="text-xs text-black/60">
              Хоризонтални карти (swipe feel). Основното действие е “? В план”.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={chipClass}>Филтър: {activeTag || "няма"}</span>
            <Link href="/festival/demo" className={`${buttonClass} bg-white/50 shadow-none`}>
              Отвори детайл
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white/70 shadow-[0_18px_50px_rgba(12,18,32,0.1)] backdrop-blur-xl">
          <div className="flex gap-3 overflow-auto p-3.5 [scroll-snap-type:x_mandatory]">
            {events.map((event) => (
              <article
                key={event.title}
                className="relative flex min-w-[min(360px,86vw)] flex-1 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white/90 shadow-[0_10px_24px_rgba(12,18,32,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_18px_46px_rgba(12,18,32,0.14)]"
                style={{ scrollSnapAlign: "start" }}
              >
                <div className="landing-cover relative h-[170px] border-b border-black/10" />
                <div className="p-3.5">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className={badgeClass}>FREE</span>
                    <span className={chipClass}>{event.city}</span>
                    <span className={chipClass}>{event.time}</span>
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold tracking-tight">{event.title}</h3>
                  <p className="mb-3 text-xs text-black/60">{event.desc}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3">
                    <span className="inline-flex items-center gap-2 rounded-[14px] border border-black/10 bg-white/90 px-2.5 py-2 text-xs text-black/60 shadow-[0_8px_18px_rgba(12,18,32,0.05)]">
                      {event.vibe} • {event.place}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={buttonClass} onClick={() => onAdd(event)}>
                        ? В план
                      </button>
                      <Link
                        href="/festival/demo"
                        className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
                      >
                        Детайли
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {events.length === 0 ? (
              <div className="flex min-h-[200px] w-full items-center justify-center text-sm text-black/60">
                Няма събития по текущия филтър.
              </div>
            ) : null}
          </div>
        </div>
        <div className="sr-only">Показани: {shownCount}</div>
      </div>
    </section>
  );
}

export type { RadarEvent };
