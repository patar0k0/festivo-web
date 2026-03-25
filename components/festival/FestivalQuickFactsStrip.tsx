type Segment = { key: string; label: string; value: string };

type Props = {
  segments: Segment[];
};

/**
 * Compact scan-friendly summary (no placeholder dashes; omit empty fields).
 */
export default function FestivalQuickFactsStrip({ segments }: Props) {
  if (!segments.length) return null;

  return (
    <section
      className="rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white to-[#fafaf8] px-4 py-3.5 sm:px-5"
      aria-label="Кратка информация"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-sm leading-snug text-[#0c0e14]">
        {segments.map((seg, i) => (
          <span key={seg.key} className="inline-flex min-w-0 flex-wrap items-baseline gap-1.5">
            {i > 0 ? (
              <span className="select-none text-black/20" aria-hidden>
                ·
              </span>
            ) : null}
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40">{seg.label}</span>
            <span className="min-w-0 font-medium text-[#0c0e14]">{seg.value}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
