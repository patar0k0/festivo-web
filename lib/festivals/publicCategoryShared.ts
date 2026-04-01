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

/**
 * Sort category slugs by active festival count (desc), then Bulgarian locale.
 * Slugs with zero active festivals sort last among non-tie cases.
 */
export function sortPublicFestivalCategorySlugsByActiveCount(
  slugs: string[],
  counts: ReadonlyMap<string, number>
): string[] {
  return [...slugs].sort((a, b) => {
    const ca = counts.get(a) ?? 0;
    const cb = counts.get(b) ?? 0;
    const aZero = ca === 0 ? 1 : 0;
    const bZero = cb === 0 ? 1 : 0;
    if (aZero !== bZero) return aZero - bZero;
    if (ca !== cb) return cb - ca;
    return a.localeCompare(b, "bg");
  });
}
