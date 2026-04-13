function hasNonEmptyGallery(galleryImageUrls: unknown): boolean {
  if (!Array.isArray(galleryImageUrls)) return false;
  return galleryImageUrls.some((u) => typeof u === "string" && u.trim().length > 0);
}

/**
 * Resolves a persisted hero for published festivals: explicit hero URL; otherwise `null` when
 * gallery media will supply imagery, or when there is no real image to persist (no placeholder).
 */
export function ensureFestivalHasImage(heroImage: string | null | undefined, galleryImageUrls?: unknown): string | null {
  const trimmedHero = typeof heroImage === "string" ? heroImage.trim() : "";
  if (trimmedHero) return trimmedHero;
  if (hasNonEmptyGallery(galleryImageUrls)) return null;
  return null;
}
