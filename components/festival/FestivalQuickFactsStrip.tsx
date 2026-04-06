import { pub } from "@/lib/public-ui/styles";

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
    <section className={pub.factsStrip} aria-label="Кратка информация">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 text-[13px] leading-snug text-[#0c0e14]">
        {segments.map((seg, i) => (
          <span key={seg.key} className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {i > 0 ? (
              <span className="select-none text-black/18" aria-hidden>
                ·
              </span>
            ) : null}
            <span className="shrink-0 text-black/42">{seg.label}</span>
            <span className="min-w-0 font-semibold text-[#0c0e14]">{seg.value}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
