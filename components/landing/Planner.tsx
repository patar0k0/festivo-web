type PlanItem = {
  title: string;
  time: string;
  city: string;
  place: string;
  vibe: string;
};

type Props = {
  items: PlanItem[];
  onRemove: (title: string) => void;
  onClear: () => void;
};

const chipClass =
  "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]";

const buttonClass =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold shadow-[0_6px_18px_rgba(12,18,32,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white/90";

export default function Planner({ items, onRemove, onClear }: Props) {
  return (
    <section className="py-4" id="plan">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Weekend Planner</h2>
            <p className="text-xs text-black/60">Добави 2-3 събития → тук става готовият план.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={chipClass}>{items.length} избрани</span>
            <button type="button" className={buttonClass} onClick={onClear}>
              Изчисти
            </button>
            <button
              type="button"
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
            >
              Напомни всички
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 max-[980px]:grid-cols-1 md:grid-cols-[1fr_0.92fr]">
          <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white/75 shadow-[0_18px_50px_rgba(12,18,32,0.1)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-white/55 px-3.5 py-3">
              <div>
                <b className="tracking-tight">Твоят план</b>
                <div className="text-xs text-black/60">Подреждаме по час (демо).</div>
              </div>
              <span className={chipClass}>маршрут</span>
            </div>
            <div className="p-3.5">
              {items.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-black/20 bg-white/65 p-3.5 text-center text-sm text-black/70">
                  Натисни "+ В план" на 2-3 събития от Radar/Trails.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {items.map((item) => (
                    <div
                      key={item.title}
                      className="grid grid-cols-[92px_1fr_auto] items-center gap-2 rounded-[18px] border border-black/10 bg-white/90 p-3 shadow-[0_10px_24px_rgba(12,18,32,0.08)] max-[560px]:grid-cols-[84px_1fr]"
                    >
                      <div className="font-black">{item.time}</div>
                      <div className="flex flex-col">
                        <b className="tracking-tight">{item.title}</b>
                        <span className="text-xs text-black/60">
                          {item.city} • {item.place} • vibe: {item.vibe}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="grid h-[38px] w-[38px] place-items-center rounded-[14px] border border-black/10 bg-white/85 shadow-[0_8px_18px_rgba(12,18,32,0.05)] transition hover:border-black/20 max-[560px]:hidden"
                        onClick={() => onRemove(item.title)}
                        aria-label={`Премахни ${item.title}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className="overflow-hidden rounded-[28px] border border-black/10 bg-white/75 shadow-[0_18px_50px_rgba(12,18,32,0.1)] backdrop-blur-xl"
            id="app"
          >
            <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-white/55 px-3.5 py-3">
              <div>
                <b className="tracking-tight">Приложение</b>
                <div className="text-xs text-black/60">
                  Нотификации с контрол: 24ч + 2ч, уикенд дайджест, ново наблизо.
                </div>
              </div>
              <span className={chipClass}>&nbsp;</span>
            </div>
            <div className="p-3.5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
                >
                  iOS
                </button>
                <button
                  type="button"
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
                >
                  Android
                </button>
                <button type="button" className={buttonClass}>
                  Настройки
                </button>
              </div>
              <div className="h-3" />
              <div className="text-xs text-black/60">
                UX: " Напомни всички" → deep link към app, за да настроиш напомнянията наведнъж.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export type { PlanItem };
