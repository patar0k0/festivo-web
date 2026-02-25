export default function AppCta() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-[18px]">
      <div className="landing-cta mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-black/10 p-4 shadow-[0_18px_50px_rgba(12,18,32,0.1)] backdrop-blur-xl">
        <div className="max-w-[74ch]">
          <h3 className="mb-1 text-base font-semibold tracking-tight">Истинската стойност: план + напомняне.</h3>
          <p className="text-xs text-black/60">Web е за откриване. App е за планиране и да не изпускаш.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
          >
            Сглоби уикенд
          </button>
          <button
            type="button"
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold shadow-[0_6px_18px_rgba(12,18,32,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white/90"
          >
            Близо до мен
          </button>
        </div>
      </div>
    </div>
  );
}
