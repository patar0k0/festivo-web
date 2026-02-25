import Link from "next/link";

const cardClass =
  "rounded-[28px] border border-black/10 bg-white/70 shadow-[0_18px_50px_rgba(12,18,32,0.1)] backdrop-blur-xl";

export default function Hero() {
  return (
    <section className="pb-4 pt-10">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className={`${cardClass} relative overflow-hidden`}>
            <div
              className="landing-spark pointer-events-none absolute -right-[190px] -top-[160px] h-[560px] w-[560px]"
              aria-hidden="true"
            />
            <div className="p-6">
              <p className="text-xs font-black text-black/60">Festival Radar • Weekend Planner • Нотификации (app)</p>
              <h1 className="mt-2.5 text-[44px] font-black leading-[1.03] tracking-[-0.9px] text-black max-[980px]:text-[38px] max-[560px]:text-[30px]">
                Не търсиш списък. Търсиш план за уикенда.
              </h1>
              <p className="mt-2 max-w-[70ch] text-base text-black/60">
                Само безплатни фестивали. Избираш 2-3 от Radar, и ти сглобяваме готов ден. После: напомняне в
                приложението → отиваш.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Link
                  href="#radar"
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
                >
                  Пусни Radar
                </Link>
                <Link
                  href="#plan"
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold shadow-[0_6px_18px_rgba(12,18,32,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white/90"
                >
                  Сглоби план
                </Link>
                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]">
                  без от 0 лв
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]">
                  град + vibe
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]">
                  24ч + 2ч
                </span>
              </div>
            </div>
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="landing-hero-side grid gap-3 p-4 sm:grid-cols-2">
              {[
                {
                  value: "100% FREE",
                  label: "само безплатни",
                  hint: "с източник към организатор",
                },
                {
                  value: "Radar",
                  label: "по vibe",
                  hint: "chill / party / family",
                },
                {
                  value: "Weekend",
                  label: "готов ден",
                  hint: "без да мислиш",
                },
                {
                  value: "Push",
                  label: "не изпускаш",
                  hint: "24ч + 2ч",
                },
              ].map((item) => (
                <div
                  key={item.value}
                  className="flex min-h-[110px] flex-col justify-between rounded-[18px] border border-black/10 bg-white/90 p-3.5 shadow-[0_10px_24px_rgba(12,18,32,0.08)]"
                >
                  <div className="text-lg font-black tracking-tight text-black">{item.value}</div>
                  <div className="text-xs font-black text-black/60">{item.label}</div>
                  <div className="text-xs text-black/70">{item.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
