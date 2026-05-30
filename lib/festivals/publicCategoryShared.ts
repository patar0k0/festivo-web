/** Fallback slug → Bulgarian display label when DB is unavailable. */
export const FESTIVAL_CATEGORY_LABELS: Record<string, string> = {
  "фолклорен фестивал": "Фолклорен фестивал",
  "събор":              "Събор",
  "кулинарен фестивал": "Кулинарен фестивал",
  "музикален фестивал": "Музикален фестивал",
  "танцов фестивал":    "Танцов фестивал",
  "културен фестивал":  "Културен фестивал",
  "арт фестивал":       "Арт фестивал",
};

export function labelForPublicCategory(slug: string): string {
  const key = slug.trim().toLocaleLowerCase("bg-BG");
  return FESTIVAL_CATEGORY_LABELS[key] ?? slug;
}

export function sortPublicFestivalCategorySlugs(slugs: Iterable<string>): string[] {
  return Array.from(slugs).sort((a, b) => a.localeCompare(b, "bg"));
}

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
