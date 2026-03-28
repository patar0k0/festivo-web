import Link from "next/link";
import { Filters } from "@/lib/types";
import { serializeFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { FESTIVAL_CATEGORY_LABELS } from "@/lib/festivals/publicCategories";

/** @deprecated Prefer `FESTIVAL_CATEGORY_LABELS` from `@/lib/festivals/publicCategories`. */
export const festivalCategoryLabels = FESTIVAL_CATEGORY_LABELS;

/** Static slugs for admin / legacy; public UI should use `listPublicFestivalCategorySlugs`. */
export const festivalCategories = Object.keys(FESTIVAL_CATEGORY_LABELS);

export default function CategoryChips({ filters, categories }: { filters: Filters; categories: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const active = filters.cat?.includes(category);
        const link = serializeFilters({ ...filters, cat: [category] });
        return (
          <Link
            key={category}
            href={`/festivals${link}`}
            scroll={false}
            className={cn(
              "rounded-full border border-black/[0.1] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25",
              active ? "border-[#0c0e14] bg-[#0c0e14] text-white hover:bg-[#0c0e14]" : ""
            )}
          >
            {festivalCategoryLabels[category.toLowerCase()] ?? category}
          </Link>
        );
      })}
    </div>
  );
}
