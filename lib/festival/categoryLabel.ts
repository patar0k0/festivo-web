import { FESTIVAL_CATEGORY_LABELS } from "@/lib/festivals/publicCategories";

export function categoryLabel(category?: string | null): string | null {
  if (!category) return null;
  const key = category.trim().toLocaleLowerCase("bg-BG");
  return FESTIVAL_CATEGORY_LABELS[key] ?? category;
}
