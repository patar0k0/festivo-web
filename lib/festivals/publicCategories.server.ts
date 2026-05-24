import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  sortPublicFestivalCategorySlugs,
  sortPublicFestivalCategorySlugsByActiveCount,
} from "@/lib/festivals/publicCategoryShared";

function toUtcDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Counts festivals per `category` where status is published or verified and end_date >= today (UTC).
 */
export async function fetchActiveFestivalCountsByCategory(): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();
  const counts = new Map<string, number>();
  const pageSize = 1000;
  let offset = 0;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayStr = toUtcDateString(todayUtc);

  for (;;) {
    const { data, error } = await supabase
      .from("festivals")
      .select("category")
      .in("status", ["published", "verified"])
      .neq("status", "archived")
      .not("category", "is", null)
      .gte("end_date", todayStr)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[fetchActiveFestivalCountsByCategory]", error.message);
      break;
    }

    const rows = data ?? [];
    for (const row of rows) {
      const c = typeof row.category === "string" ? row.category.trim() : "";
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
    if (offset > 20000) break;
  }

  return counts;
}

/**
 * All public category slugs, ordered by active festival count (desc), then locale.
 */
export async function listPublicFestivalCategorySlugsSortedByActiveCount(): Promise<string[]> {
  const [slugs, counts] = await Promise.all([
    listPublicFestivalCategorySlugs(),
    fetchActiveFestivalCountsByCategory(),
  ]);
  return sortPublicFestivalCategorySlugsByActiveCount(slugs, counts);
}

/**
 * Distinct non-empty `festivals.category` values for published/public scope.
 *
 * Categories are deduplicated case-insensitively (so "фолклорен фестивал"
 * and "Фолклорен фестивал" collapse to one entry) and returned with a
 * sentence-cased display label — Cyrillic-aware first-letter uppercase via
 * `String.prototype.toLocaleUpperCase("bg-BG")`.
 *
 * The chosen display form is whichever spelling appears most often in the
 * DB; ties broken by first-seen. Filter-side matching uses `ilike` (see
 * `buildFestivalsTagOrFilter`) so the URL value catches every casing.
 */
export async function listPublicFestivalCategorySlugs(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  // Map normalised key (lowercase trimmed) → { count, mostCommonForm }.
  type Bucket = { count: number; mostCommon: string; mostCommonCount: number; variants: Map<string, number> };
  const buckets = new Map<string, Bucket>();
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("festivals")
      .select("category")
      .or("status.eq.published,status.eq.verified,is_verified.eq.true")
      .neq("status", "archived")
      .not("category", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[listPublicFestivalCategorySlugs]", error.message);
      break;
    }

    const rows = data ?? [];
    for (const row of rows) {
      const raw = typeof row.category === "string" ? row.category.trim() : "";
      if (!raw) continue;
      const key = raw.toLocaleLowerCase("bg-BG");
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        const variantCount = (existing.variants.get(raw) ?? 0) + 1;
        existing.variants.set(raw, variantCount);
        if (variantCount > existing.mostCommonCount) {
          existing.mostCommon = raw;
          existing.mostCommonCount = variantCount;
        }
      } else {
        buckets.set(key, {
          count: 1,
          mostCommon: raw,
          mostCommonCount: 1,
          variants: new Map([[raw, 1]]),
        });
      }
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
    if (offset > 20000) break;
  }

  // Sentence-case the canonical form so display is consistent regardless of
  // which DB variant won the popularity contest.
  const canonical = new Set<string>();
  for (const bucket of buckets.values()) {
    canonical.add(sentenceCase(bucket.mostCommon));
  }

  return sortPublicFestivalCategorySlugs(canonical);
}

/**
 * Capitalise the first letter, leave the rest unchanged. Uses Bulgarian
 * locale-aware uppercase so Cyrillic specifics (e.g. "и" vs "И") map cleanly.
 * Latin words also benefit (e.g. "festival" → "Festival").
 */
function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const first = trimmed.charAt(0).toLocaleUpperCase("bg-BG");
  return first + trimmed.slice(1);
}
