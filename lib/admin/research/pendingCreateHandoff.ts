import { transliteratedSlug } from "@/lib/text/slug";
import type { ResearchBestGuess, ResearchFestivalResult } from "@/lib/admin/research/types";

export function sanitizeHandoffString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** ASCII [a-z0-9-] slug segment; empty if nothing usable. */
function asciiSlugFromMixedText(text: string): string {
  const translit = transliteratedSlug(text);
  const base = translit.length > 0 ? translit : text.toLowerCase().trim();
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Non-empty pending slug from research: prefer explicit slug, else transliterated title (BG→Latin),
 * aligned with `transliteratedSlug` + organizer-style ASCII normalization.
 */
export function resolvePendingSlugFromResearch(slugGuess: unknown, title: unknown): string {
  const slugDirect = sanitizeHandoffString(slugGuess);
  const titleStr = sanitizeHandoffString(title) ?? "";

  const fromExplicit = slugDirect ? asciiSlugFromMixedText(slugDirect) : "";
  if (fromExplicit) return fromExplicit;

  const fromTitle = asciiSlugFromMixedText(transliteratedSlug(titleStr) || titleStr);
  if (fromTitle) return fromTitle;

  return "festival-research-draft";
}

/** City text for `city_guess` / `city_name_display`: best_guess first, then first city candidate, then evidence. */
export function resolveCityTextForPending(best: ResearchBestGuess, normalized: ResearchFestivalResult): string | null {
  const direct = sanitizeHandoffString(best.city);
  if (direct) return direct;

  for (const c of normalized.candidates.cities) {
    const v = sanitizeHandoffString(c.value);
    if (v) return v;
  }

  for (const ev of normalized.evidence) {
    if (sanitizeHandoffString(ev.field)?.toLowerCase() === "city") {
      const v = sanitizeHandoffString(ev.value);
      if (v) return v;
    }
  }

  return null;
}

/** Venue / place line: `location` field, then first location candidate. */
export function resolveVenueTextForPending(best: ResearchBestGuess, normalized: ResearchFestivalResult): string | null {
  const direct = sanitizeHandoffString(best.location);
  if (direct) return direct;

  for (const c of normalized.candidates.locations) {
    const v = sanitizeHandoffString(c.value);
    if (v) return v;
  }

  return null;
}
