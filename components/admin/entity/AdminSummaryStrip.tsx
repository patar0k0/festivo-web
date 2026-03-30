import type { ReactNode } from "react";

export type AdminSummaryItem = {
  label: string;
  value: ReactNode;
};

/**
 * Top summary row: title, key facts, primary actions. Use em dash or omit for N/A fields.
 */
export default function AdminSummaryStrip({
  title,
  eyebrow,
  items,
  actions,
  className = "",
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  items: AdminSummaryItem[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-black/[0.08] bg-white/90 p-4 shadow-[0_2px_0_rgba(12,14,20,0.04),0_8px_20px_rgba(12,14,20,0.06)] md:p-5 ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">{eyebrow}</div> : null}
          <div className="mt-1 text-xl font-black tracking-tight text-[#0c0e14] md:text-2xl">{title}</div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.label} className="min-w-0 rounded-lg border border-black/[0.06] bg-black/[0.02] px-2.5 py-1.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">{item.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-black/80">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
