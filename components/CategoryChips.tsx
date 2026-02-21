import Link from "next/link";
import { Filters } from "@/lib/types";
import { serializeFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

const categories = ["folk", "jazz", "rock", "wine", "food", "kids", "heritage", "art"];

export default function CategoryChips({ filters }: { filters: Filters }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const active = filters.cat?.includes(category);
        const link = serializeFilters({ ...filters, cat: [category] });
        return (
          <Link
            key={category}
            href={`/festivals${link}`}
            className={cn(
              "rounded-full border border-ink/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider",
              active ? "bg-ink text-white" : "bg-white/70 text-ink"
            )}
          >
            {category}
          </Link>
        );
      })}
    </div>
  );
}
