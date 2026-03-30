import type { ReactNode } from "react";

const VARIANT_CLASS: Record<
  "default" | "main" | "date" | "location" | "organizer" | "links" | "media" | "description" | "system",
  string
> = {
  default: "border-black/[0.08] bg-white/85 border-l-[3px] border-l-black/[0.12]",
  main: "border-black/[0.08] bg-[#f8fafc]/90 border-l-[3px] border-l-slate-400/35",
  date: "border-black/[0.08] bg-[#fffbeb]/80 border-l-[3px] border-l-amber-500/35",
  location: "border-black/[0.08] bg-[#f0fdf4]/75 border-l-[3px] border-l-emerald-600/30",
  organizer: "border-black/[0.08] bg-[#faf5ff]/80 border-l-[3px] border-l-violet-500/30",
  links: "border-black/[0.08] bg-[#f0f9ff]/75 border-l-[3px] border-l-sky-500/30",
  media: "border-black/[0.08] bg-[#f7f7f4]/90 border-l-[3px] border-l-stone-500/25",
  description: "border-black/[0.08] bg-[#fafafa]/90 border-l-[3px] border-l-neutral-500/25",
  system: "border-black/[0.08] bg-[#f8f9fc]/95 border-l-[3px] border-l-[#0c0e14]/20",
};

/**
 * Card wrapper for a logical field group with subtle category tint.
 */
export default function AdminFieldSection({
  title,
  description,
  variant = "default",
  children,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  variant?: keyof typeof VARIANT_CLASS;
  children: ReactNode;
  className?: string;
}) {
  const isSystem = variant === "system";
  return (
    <section
      className={`rounded-xl border shadow-[0_2px_0_rgba(12,14,20,0.04),0_8px_20px_rgba(12,14,20,0.05)] ${isSystem ? "p-2.5" : "p-3"} ${VARIANT_CLASS[variant]} ${className}`.trim()}
    >
      <div className={isSystem ? "mb-1" : "mb-1.5"}>
        <h2
          className={
            isSystem
              ? "text-xs font-semibold tracking-tight text-black/50"
              : "text-sm font-bold leading-tight tracking-tight text-[#0c0e14]"
          }
        >
          {title}
        </h2>
        {description ? (
          <p
            className={
              isSystem ? "mt-0.5 text-[11px] leading-snug text-black/45" : "mt-0.5 text-xs leading-snug text-black/55"
            }
          >
            {description}
          </p>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
