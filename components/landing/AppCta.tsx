export default function AppCta() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-[18px]">
      <div className="mt-3 flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-[#0c0e14] px-10 py-9 shadow-[0_2px_0_rgba(12,14,20,0.14),0_20px_56px_rgba(12,14,20,0.22)] max-[560px]:px-6 max-[560px]:py-7">
        <div>
          <h3 className="mb-1.5 text-[20px] font-black tracking-[-0.5px] text-white">
            Истинската стойност: план + напомняне.
          </h3>
          <p className="text-[13px] leading-relaxed text-white/45 max-w-[46ch]">
            Web е за откриване. App е за планиране и да не изпускаш нищо.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-[42px] items-center gap-2 rounded-[14px] bg-white px-5 text-sm font-extrabold text-[#0c0e14] transition hover:bg-[#f0ede8] hover:-translate-y-px"
          >
            Сглоби уикенд →
          </button>
          <button
            type="button"
            className="inline-flex h-[42px] items-center gap-2 rounded-[14px] border border-white/20 bg-transparent px-5 text-sm font-bold text-white/60 transition hover:border-white/40 hover:text-white"
          >
            Близо до мен
          </button>
        </div>
      </div>
    </div>
  );
}
