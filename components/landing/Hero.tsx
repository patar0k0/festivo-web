import Link from "next/link";

const cardClass =
  "rounded-[24px] border border-black/[0.08] bg-white shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)]";

export default function Hero() {
  return (
    <section className="pb-4 pt-10">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">

          {/* Main headline card */}
          <div className={`${cardClass} relative overflow-hidden p-8 max-[560px]:p-6`}>
            {/* Eyebrow */}
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,76,31,0.1)] px-3 py-1 text-[11px] font-extrabold tracking-widest text-[#ff4c1f] uppercase">
              ● Live сега — уикенд
            </div>

            <h1 className="mb-3 text-[44px] font-black leading-[1.03] tracking-[-1.2px] text-[#0c0e14] max-[980px]:text-[36px] max-[560px]:text-[28px]">
              Не търсиш списък.<br />
              Търсиш план за уикенда.
            </h1>

            <p className="mb-6 max-w-[52ch] text-[15px] leading-relaxed text-black/60">
              Само безплатни фестивали. Избираш 2–3 от Radar, сглобяваме готов ден. После: напомняне в приложението → отиваш.
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="#radar"
                className="inline-flex h-[42px] items-center gap-2 rounded-[14px] bg-[#0c0e14] px-5 text-sm font-extrabold text-white transition hover:bg-[#1e2030] hover:-translate-y-px"
              >
                Пусни Radar →
              </Link>
              <Link
                href="#plan"
                className="inline-flex h-[42px] items-center gap-2 rounded-[14px] border border-black/[0.1] bg-white px-5 text-sm font-bold shadow-[0_2px_0_rgba(12,14,20,0.06),0_8px_20px_rgba(12,14,20,0.06)] transition hover:border-black/20 hover:-translate-y-px"
              >
                Сглоби план
              </Link>
              <span className="inline-flex items-center rounded-full border border-black/[0.08] bg-[#f5f4f0] px-3 py-1.5 text-xs font-bold text-black/50">
                0 лв
              </span>
              <span className="inline-flex items-center rounded-full border border-black/[0.08] bg-[#f5f4f0] px-3 py-1.5 text-xs font-bold text-black/50">
                grad + vibe
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Featured top-full-width card */}
            <div className="col-span-2 flex items-center justify-between rounded-[20px] bg-[#0c0e14] px-6 py-4 text-white shadow-[0_2px_0_rgba(12,14,20,0.12),0_12px_32px_rgba(12,14,20,0.2)]">
              <div>
                <div className="text-2xl font-black tracking-tight">100% FREE</div>
                <div className="mt-0.5 text-xs font-bold uppercase tracking-wider text-white/40">само безплатни</div>
              </div>
              <span className="text-4xl opacity-60">🎉</span>
            </div>

            {[
              { value: "Radar", label: "по vibe", hint: "chill / party / family" },
              { value: "Weekend", label: "готов ден", hint: "без да мислиш" },
              { value: "Push", label: "не изпускаш", hint: "24ч + 2ч" },
              { value: "Map", label: "наблизо", hint: "по град и квартал" },
            ].map((item) => (
              <div
                key={item.value}
                className="flex flex-col justify-between rounded-[20px] border border-black/[0.08] bg-white p-4 shadow-[0_2px_0_rgba(12,14,20,0.06),0_10px_24px_rgba(12,14,20,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_0_rgba(12,14,20,0.08),0_20px_48px_rgba(12,14,20,0.12)]"
              >
                <div className="text-xl font-black tracking-tight text-[#0c0e14]">{item.value}</div>
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-black/40">{item.label}</div>
                  <div className="mt-0.5 text-[11px] text-black/30">{item.hint}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
