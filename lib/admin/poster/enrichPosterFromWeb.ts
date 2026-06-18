import "server-only";
import type { PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";
import { mergeWebIntoPoster } from "@/lib/admin/poster/mergeWebIntoPoster.mjs";
import { geminiGroundedSearchHits } from "@/lib/admin/research/gemini-provider";
import { fetchSourceDocument } from "@/lib/admin/research/source-extract";
import { extractFestivalFieldsFromEvidence } from "@/lib/admin/research/gemini-extract";

const MAX_SOURCES = 2;

/**
 * Pass 2 web enrichment: searches for the festival by title and fills in
 * fields that the poster vision left null or flagged needs_review.
 * Always returns a PosterExtraction — failures are silent (returns original).
 */
export async function enrichPosterFromWeb(
  extraction: PosterExtraction,
  title: string,
): Promise<PosterExtraction> {
  if (!title.trim()) return extraction;

  try {
    const query = `${title} фестивал България`;
    const hits = await geminiGroundedSearchHits(query);
    if (!hits.length) return extraction;

    const urls = hits.slice(0, MAX_SOURCES).map((h) => h.url);

    const docs = await Promise.all(urls.map((u) => fetchSourceDocument(u).catch(() => null)));
    const bestDoc = docs.find((d) => d && d.excerpt?.length > 100) ?? null;

    if (!bestDoc) return extraction;

    const web = await extractFestivalFieldsFromEvidence({
      userQuery: query,
      sourceUrl: bestDoc.url,
      pageTitle: bestDoc.title,
      excerpt: bestDoc.excerpt,
    });

    return mergeWebIntoPoster(extraction, web);
  } catch {
    // Web enrichment is best-effort: never abort the main pipeline
    return extraction;
  }
}
