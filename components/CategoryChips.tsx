import Link from "next/link";
import { Filters } from "@/lib/types";
import { serializeFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

export const festivalCategories = ["folk", "jazz", "rock", "wine", "food", "kids", "heritage", "art"];
export const festivalCategoryLabels: Record<string, string> = {
  folk: "Фолклор",
  jazz: "Джаз",
  rock: "Рок",
  wine: "Вино",
  food: "Храна",
  kids: "Семейни",
  heritage: "Традиции",
  art: "Изкуство",
};

export default function CategoryChips({ filters }: { filters: Filters }) {
  return (
    <div className="flex flex-wrap gap-2">
      {festivalCategories.map((category) => {
        const active = filters.cat?.includes(category);
        const link = serializeFilters({ ...filters, cat: [category] });
        return (
          <Link
            key={category}
            href={`/festivals${link}`}
            className={cn(
              "rounded-full border border-black/[0.1] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25",
              active ? "border-[#0c0e14] bg-[#0c0e14] text-white hover:bg-[#0c0e14]" : ""
            )}
          >
            {festivalCategoryLabels[category] ?? category}
          </Link>
        );
      })}
    </div>
  );
}
