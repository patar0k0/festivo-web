import Link from "next/link";
import { Filters } from "@/lib/types";
import { serializeFilters } from "@/lib/filters";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

const views = [
  { label: "Списък", href: "/festivals" },
  { label: "Карта", href: "/map" },
  { label: "Календар", href: "/calendar" },
];

export default function ViewToggle({ active, filters }: { active: string; filters: Filters }) {
  const query = serializeFilters(filters);
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-amber-200/40 bg-white/90 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm ring-1 ring-amber-100/25">
      {views.map((view) => (
        <Link
          key={view.href}
          href={`${view.href}${query}`}
          className={cn(
            "px-4 py-2 transition",
            pub.focusRing,
            active === view.href ? "bg-[#7c2d12] text-white" : "text-[#0c0e14] hover:bg-amber-50/80",
          )}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}
