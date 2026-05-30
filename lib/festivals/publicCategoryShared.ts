/** Ordered list of the 7 canonical festival category slugs (lowercase, stored as-is in DB). */
export const CANONICAL_FESTIVAL_CATEGORIES = [
  "фолклорен фестивал",
  "събор",
  "кулинарен фестивал",
  "музикален фестивал",
  "танцов фестивал",
  "културен фестивал",
  "арт фестивал",
] as const;

export type CanonicalFestivalCategory = (typeof CANONICAL_FESTIVAL_CATEGORIES)[number];

/** Maps free-form DB values (lowercase trimmed) → canonical category slug, or null if unknown. */
const CATEGORY_MAP: Record<string, CanonicalFestivalCategory> = {
  // Фолклорен фестивал
  "фолклорен фестивал": "фолклорен фестивал",
  "фолк фестивал": "фолклорен фестивал",
  "folk festival": "фолклорен фестивал",
  "фолклорен конкурс": "фолклорен фестивал",
  "конкурс-надиграване": "фолклорен фестивал",
  "фестивал-надиграване": "фолклорен фестивал",
  "фолклорен танцов": "фолклорен фестивал",
  "фолклорен танцов фестивал": "фолклорен фестивал",
  "фолклор": "фолклорен фестивал",
  "национален фолклорен": "фолклорен фестивал",
  "фолкорен фестивал": "фолклорен фестивал",
  "международен фолклорен фестивал": "фолклорен фестивал",
  "фолклорен празник": "фолклорен фестивал",
  "кукерски карнавал": "фолклорен фестивал",
  // Събор
  "събор": "събор",
  "традиционен събор": "събор",
  "събор-надпяване": "събор",
  "фолклорен събор": "събор",
  // Кулинарен фестивал
  "кулинарен фестивал": "кулинарен фестивал",
  "гастрономически фестивал": "кулинарен фестивал",
  "кулинарно-фолклорен фестивал": "кулинарен фестивал",
  "кулинарен и фолклорен фестивал": "кулинарен фестивал",
  "кулинарен фестивал / фолклорен празник": "кулинарен фестивал",
  "кулинарно-фолклорен": "кулинарен фестивал",
  "кулинарно-фолклорен празник": "кулинарен фестивал",
  "кулинарен празник": "кулинарен фестивал",
  "кулинарен празник / фолклорен празник": "кулинарен фестивал",
  "винен фестивал": "кулинарен фестивал",
  // Музикален фестивал
  "музикален фестивал": "музикален фестивал",
  "музика": "музикален фестивал",
  "концерт": "музикален фестивал",
  "празничен концерт": "музикален фестивал",
  // Танцов фестивал
  "танцов фестивал": "танцов фестивал",
  "танцово изкуство": "танцов фестивал",
  // Културен фестивал
  "културен фестивал": "културен фестивал",
  "балкански фестивал": "културен фестивал",
  "градски празник": "културен фестивал",
  // Арт фестивал
  "арт фестивал": "арт фестивал",
};

/**
 * Maps any free-form category string to a canonical value.
 * Input is lowercased+trimmed before lookup.
 * Returns null for unrecognized values — admin must classify manually.
 */
export function mapToCanonicalCategory(value: string | null | undefined): CanonicalFestivalCategory | null {
  if (!value) return null;
  const key = value.trim().toLocaleLowerCase("bg-BG");
  return CATEGORY_MAP[key] ?? null;
}

/** Canonical slug → Bulgarian display label (sentence-cased). */
export const FESTIVAL_CATEGORY_LABELS: Record<string, string> = {
  "фолклорен фестивал": "Фолклорен фестивал",
  "събор": "Събор",
  "кулинарен фестивал": "Кулинарен фестивал",
  "музикален фестивал": "Музикален фестивал",
  "танцов фестивал": "Танцов фестивал",
  "културен фестивал": "Културен фестивал",
  "арт фестивал": "Арт фестивал",
};

export function labelForPublicCategory(slug: string): string {
  const key = slug.trim();
  if (!key) return key;
  const lower = key.toLocaleLowerCase("bg-BG");
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
