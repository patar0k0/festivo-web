import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { pub } from "@/lib/public-ui/styles";
import type { HomeCategoryOption } from "@/lib/home/loadHomePageData";

/**
 * Навигационна лента „Разгледай по категория" — симетрична на `CitiesSection`.
 * Показва категориите с предстоящи фестивали като плочки с брой, водещи към
 * `/festivals?tag=<category>`. Изтъква разнообразието отвъд доминиращия фолклор.
 * Различен формат от фестивалните карти → не може да дублира хронологичните ленти.
 */
export default function CategoriesSection({ categories }: { categories: HomeCategoryOption[] }) {
  if (!categories.length) return null;

  return (
    <section id="home-categories" className={cn(pub.panelMuted, "p-5 md:p-6")}>
      <h2 className={cn(pub.pageTitle, "text-2xl")}>Разгледай по категория</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/festivals?tag=${encodeURIComponent(category.slug)}`}
            className={cn(pub.chip, pub.focusRing, "inline-flex items-baseline gap-1.5 hover:bg-[#f7f6f3]")}
          >
            <span>{category.label}</span>
            <span className="tabular-nums text-black/55">{category.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
