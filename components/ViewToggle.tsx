import Link from "next/link";
import { Filters } from "@/lib/types";
import { serializeFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

const views = [
  { label: "List", href: "/festivals" },
  { label: "Map", href: "/map" },
  { label: "Calendar", href: "/calendar" },
];

export default function ViewToggle({ active, filters }: { active: string; filters: Filters }) {
  const query = serializeFilters(filters);
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-ink/10 bg-white/80 text-xs font-semibold uppercase tracking-wider">
      {views.map((view) => (
        <Link
          key={view.href}
          href={`${view.href}${query}`}
          className={cn(
            "px-4 py-2",
            active === view.href ? "bg-ink text-white" : "text-ink"
          )}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}
