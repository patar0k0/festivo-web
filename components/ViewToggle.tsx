import Link from "next/link";
import { Filters } from "@/lib/types";
import { serializeFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

const views = [
  { label: "Списък", href: "/festivals" },
  { label: "Карта", href: "/map" },
  { label: "Календар", href: "/calendar" },
];

export default function ViewToggle({ active, filters }: { active: string; filters: Filters }) {
  const query = serializeFilters(filters);
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-black/[0.1] bg-white/80 text-xs font-semibold uppercase tracking-[0.14em] shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_18px_rgba(12,14,20,0.06)]">
      {views.map((view) => (
        <Link
          key={view.href}
          href={`${view.href}${query}`}
          className={cn(
            "px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25",
            active === view.href ? "bg-[#0c0e14] text-white" : "text-[#0c0e14] hover:bg-black/[0.04]"
          )}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}
