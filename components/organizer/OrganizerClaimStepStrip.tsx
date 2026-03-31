const steps = ["Изпращаш заявка", "Екипът я преглежда", "Получаваш достъп"] as const;

export default function OrganizerClaimStepStrip() {
  return (
    <div className="rounded-xl border border-amber-200/60 bg-white/70 px-3 py-2.5 md:px-4 md:py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-900/55">Как протича</p>
      <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs text-black/80">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-1">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
              {i + 1}
            </span>
            <span>{label}</span>
            {i < steps.length - 1 ? (
              <span className="mx-1 text-amber-300 sm:mx-2" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
