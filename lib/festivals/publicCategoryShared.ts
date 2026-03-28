/** Known slug → Bulgarian label; unknown slugs display as stored. */
export const FESTIVAL_CATEGORY_LABELS: Record<string, string> = {
  folk: "Фолклор",
  jazz: "Джаз",
  rock: "Рок",
  wine: "Вино",
  food: "Храна",
  kids: "Семейни",
  heritage: "Традиции",
  art: "Изкуство",
  music: "Музика",
  arts: "Изкуство",
  cultural: "Култура",
  sports: "Спорт",
  film: "Кино",
  theater: "Театър",
};

export function labelForPublicCategory(slug: string): string {
  const key = slug.trim();
  if (!key) return key;
  const lower = key.toLowerCase();
  return FESTIVAL_CATEGORY_LABELS[lower] ?? FESTIVAL_CATEGORY_LABELS[key] ?? key;
}

/** Locale sort used for public category chip lists (matches DB-derived slug ordering). */
export function sortPublicFestivalCategorySlugs(slugs: Iterable<string>): string[] {
  return Array.from(slugs).sort((a, b) => a.localeCompare(b, "bg"));
}
