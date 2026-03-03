export type PlanItem = {
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

export default function Planner({ items, onRemove, onClear }: Props) {
  return (
    <section className="py-4" id="plan">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-black tracking-[-0.5px] text-[#0c0e14]">
              Твоят план
            </h2>
            <p className="mt-0.5 text-[13px] text-black/50">
              Добавяй от Radar и Trails
            </p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-black/[0.08] bg-[#f5f4f0] px-3 py-1 text-[12px] font-bold text-black/50">
                {items.length} избрани
              </span>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex h-[34px] items-center rounded-[12px] border border-black/[0.1] bg-white px-3.5 text-[12px] font-bold shadow-[0_2px_0_rgba(12,14,20,0.06)] transition hover:border-black/20 hover:bg-[#f5f4f0]"
              >
                Изчисти
              </button>
              <button
                type="button"
                className="inline-flex h-[34px] items-center rounded-[12px] bg-[#0c0e14] px-3.5 text-[12px] font-extrabold text-white transition hover:bg-[#1e2030]"
              >
                Напомни всички
              </button>
            </div>
          )}
        </div>

        {/* Plan items or empty state */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-black/[0.14] bg-white/60 py-14 text-center">
            <span className="text-4xl">📅</span>
            <p className="text-[14px] font-bold text-black/40">
              Планът е празен — добави 2–3 от Radar
            </p>
            <a
              href="#radar"
              className="mt-1 inline-flex h-[34px] items-center rounded-[12px] border border-black/[0.1] bg-white px-4 text-[12px] font-bold shadow-[0_2px_0_rgba(12,14,20,0.06)] transition hover:border-black/20"
            >
              Обратно към Radar
            </a>
          </div>
        ) : (
          <div className="grid gap-3 max-[980px]:grid-cols-1 md:grid-cols-[1fr_0.9fr]">
            {/* Timeline */}
            <div className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)]">
              <div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4">
                <div>
                  <p className="font-extrabold tracking-tight text-[#0c0e14]">Твоят план</p>
                  <p className="text-[12px] text-black/40">Подреждаме по час</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-4">
                {items.map((item) => (
                  <div
                    key={item.title}
                    className="grid grid-cols-[80px_1fr_auto] items-center gap-3 rounded-[16px] border border-black/[0.07] bg-[#f5f4f0] px-4 py-3"
                  >
                    <div className="text-[14px] font-black tabular-nums text-[#0c0e14]">
                      {item.time}
                    </div>
                    <div>
                      <p className="text-[13px] font-extrabold tracking-tight text-[#0c0e14]">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-black/40">
                        {item.city} · {item.place} · {item.vibe}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.title)}
                      aria-label={`Премахни ${item.title}`}
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border border-black/[0.1] bg-white text-[13px] text-black/40 transition hover:border-black/20 hover:text-black/70"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* App panel */}
            <div
              className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)]"
              id="app"
            >
              <div className="border-b border-black/[0.07] px-5 py-4">
                <p className="font-extrabold tracking-tight text-[#0c0e14]">Приложение</p>
                <p className="text-[12px] text-black/40">
                  Нотификации с контрол: 24ч + 2ч, уикенд дайджест
                </p>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-[38px] items-center rounded-[12px] bg-[#0c0e14] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#1e2030]"
                  >
                    iOS
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-[38px] items-center rounded-[12px] bg-[#0c0e14] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#1e2030]"
                  >
                    Android
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-[38px] items-center rounded-[12px] border border-black/[0.1] bg-transparent px-4 text-[13px] font-bold transition hover:bg-[#f5f4f0]"
                  >
                    Настройки
                  </button>
                </div>
                <p className="mt-3 text-[12px] text-black/35">
                  &quot;Напомни всички&quot; → deep link към app за настройка на всички напомняния наведнъж.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
