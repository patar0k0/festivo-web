import "server-only";
import { serpApiSearch, serpApiImageSearch } from "@/lib/research/serpApiSearch";
import { researchFestival } from "@/lib/research/perplexity";
import { extractFestivalFieldsFromEvidence } from "@/lib/admin/research/gemini-extract";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { fetchSourceDocument } from "@/lib/admin/research/source-extract";
import { programDraftFromGeminiProgram } from "@/lib/festival/programDraft";
import type { ProgramDraft } from "@/lib/festival/programDraft";

/** Домейни, от които е безсмислено да извличаме пълно съдържание */
const SKIP_FETCH_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
  "google.com",
  "wikipedia.org",
  "pdf",
]);

function shouldFetchDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return !SKIP_FETCH_DOMAINS.has(host) && !url.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

export type SmartResearchSource = {
  url: string;
  title: string | null;
  domain: string;
  snippet: string | null;
  is_ai_overview: boolean;
};

export type SmartResearchFields = {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  organizer_names: string[] | null;
  description: string | null;
  is_free: boolean | null;
  category: string | null;
  tags: string[];
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  ticket_url: string | null;
  hero_image: string | null;
  /**
   * Up to 3 deduplicated image URL candidates extracted from the fetched source
   * documents (og:image first, then twitter/JSON-LD/<img> fallbacks). The admin
   * picks one as the hero in the UI; the rest are sent as `gallery_image_urls`
   * to the pending row.
   */
  hero_image_candidates: string[];
  program_draft: ProgramDraft | null;
};

const MAX_IMAGE_CANDIDATES = 3;

export type SmartResearchResult = {
  fields: SmartResearchFields;
  sources: SmartResearchSource[];
  confidence: "high" | "medium" | "low";
  providers_used: string[];
  warnings: string[];
  /** Actual Gemini model ID used for extraction (e.g. "gemini-2.5-flash" or "gemini-2.0-flash" on fallback). */
  gemini_model: string | null;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function domainFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function confidenceLevel(fields: SmartResearchFields, sourcesCount: number): "high" | "medium" | "low" {
  const filled = [fields.title, fields.start_date, fields.city, fields.organizer_name].filter(Boolean).length;
  if (filled >= 3 && sourcesCount >= 2) return "high";
  if (filled >= 2) return "medium";
  return "low";
}

function looksLikeRealImageUrl(url: string): boolean {
  return (
    /\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(url) ||
    /\/(image|img|photo|media|upload|cdn|tbn|images)\b/i.test(url) ||
    /encrypted-tbn|gstatic\.com|fbcdn\.net|cdninstagram|ytimg\.com/i.test(url)
  );
}

/**
 * Returns up to `max` unique image URLs from multiple sources, in this order:
 *   1. SerpAPI-discovered URLs (knowledge_graph / inline_images / top_stories /
 *      organic thumbnails) — these are Google's curated picks for the query.
 *   2. Per-doc og:image / JSON-LD / <img> from fetched HTML pages.
 *
 * The first non-image-looking candidate is always kept as a last resort so the
 * UI has at least one preview to render — `rehostHeroImageFromUrl` validates
 * content-type when it downloads.
 */
function pickTopImageCandidates(
  serpImages: ReadonlyArray<string>,
  docs: ReadonlyArray<{ images: string[] }>,
  max = MAX_IMAGE_CANDIDATES,
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  const pushCandidate = (url: string) => {
    if (results.length >= max) return;
    if (seen.has(url)) return;
    seen.add(url);
    if (looksLikeRealImageUrl(url) || results.length === 0) {
      results.push(url);
    }
  };

  for (const url of serpImages) {
    if (results.length >= max) break;
    pushCandidate(url);
  }
  for (const doc of docs) {
    if (results.length >= max) break;
    for (const candidate of doc.images) {
      if (results.length >= max) break;
      pushCandidate(candidate);
    }
  }

  return results;
}

export async function runSmartResearchPipeline(query: string): Promise<SmartResearchResult> {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY is not configured");

  const warnings: string[] = [];
  const providers_used: string[] = ["serpapi"];

  // Step 1: parallel SerpAPI calls (EN for AI Overview, BG for organic results)
  const [enResult, bgResult] = await Promise.all([
    serpApiSearch(query, "en").catch(() => ({ ai_overview_text: null, organic: [], image_urls: [] })),
    serpApiSearch(query, "bg").catch(() => ({ ai_overview_text: null, organic: [], image_urls: [] })),
  ]);

  const aiOverviewText = enResult.ai_overview_text;
  const organic = bgResult.organic;
  // SerpAPI gave us image URLs in both responses (knowledge_graph, inline_images,
  // top_stories, organic thumbnails). Combine, BG first (more locally relevant).
  const serpImageUrls: string[] = [];
  const seenSerpImg = new Set<string>();
  for (const url of [...bgResult.image_urls, ...enResult.image_urls]) {
    if (seenSerpImg.has(url)) continue;
    seenSerpImg.add(url);
    serpImageUrls.push(url);
  }

  // Step 1.5: fetch full page content for top organic results (parallel, best-effort).
  // Up to 5 non-blocked candidates so that social-media-heavy result pages
  // (where the first few organic hits are Facebook/Instagram/YouTube) still produce
  // at least one fetchable document with image candidates.
  const fetchCandidates = organic.filter((r) => shouldFetchDomain(r.url)).slice(0, 5);
  const fetchedDocs = (
    await Promise.allSettled(fetchCandidates.map((r) => fetchSourceDocument(r.url)))
  )
    .map((res) => (res.status === "fulfilled" ? res.value : null))
    .filter((doc): doc is NonNullable<typeof doc> => doc !== null && doc.excerpt.length > 100);

  // Diagnostic warnings so admins can troubleshoot missing images via the panel.
  const skippedCount = organic.length - fetchCandidates.length;
  if (skippedCount > 0) {
    warnings.push(`${skippedCount} органич. резултата пропуснати (социални мрежи / PDF). Опитани: ${fetchCandidates.length}, успешни: ${fetchedDocs.length}.`);
  } else if (fetchCandidates.length > 0 && fetchedDocs.length === 0) {
    warnings.push(`Опитани ${fetchCandidates.length} URL-а — всички неуспешни (timeout / заблокирани / non-HTML).`);
  }

  // Step 2: quality check — Perplexity fallback when results are thin
  const bgDomainCount = organic.filter((r) => r.url.toLowerCase().includes(".bg")).length;
  const hasFullContent = fetchedDocs.length >= 1;
  const hasGoodResults = Boolean(aiOverviewText) || bgDomainCount >= 3 || hasFullContent;

  let perplexityContext: string | null = null;
  if (!hasGoodResults && process.env.PERPLEXITY_API_KEY?.trim()) {
    try {
      const pr = await researchFestival(query);
      const parts: string[] = [];
      if (pr.title) parts.push(`Заглавие: ${pr.title}`);
      if (pr.start_date) parts.push(`Начална дата: ${pr.start_date}`);
      if (pr.end_date) parts.push(`Крайна дата: ${pr.end_date}`);
      if (pr.city) parts.push(`Град: ${pr.city}`);
      if (pr.location_name) parts.push(`Място: ${pr.location_name}`);
      if (pr.organizer_name) parts.push(`Организатор: ${pr.organizer_name}`);
      if (pr.description) parts.push(`Описание: ${pr.description.slice(0, 800)}`);
      if (parts.length > 0) {
        perplexityContext = parts.join("\n");
        providers_used.push("perplexity");
      }
    } catch (e) {
      warnings.push(`Perplexity fallback failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Step 3: build combined evidence for Gemini
  const evidenceParts: string[] = [];
  if (aiOverviewText) {
    evidenceParts.push(`=== Google AI Overview ===\n${aiOverviewText}`);
  }

  const fetchedUrls = new Set(fetchedDocs.map((d) => d.url));
  for (const doc of fetchedDocs) {
    evidenceParts.push(`=== ${doc.title} (${doc.url}) ===\n${doc.excerpt}`);
  }

  for (const r of organic.slice(0, 6)) {
    if (!fetchedUrls.has(r.url) && r.snippet) {
      evidenceParts.push(`=== ${r.title ?? r.url} (${r.url}) ===\n${r.snippet}`);
    }
  }

  if (perplexityContext) {
    evidenceParts.push(`=== Perplexity Research ===\n${perplexityContext}`);
  }
  const combinedEvidence = evidenceParts.join("\n\n");

  // Step 4: single Gemini extraction call
  let extraction = null;
  let geminiModelUsed: string | null = null;
  if (combinedEvidence.trim()) {
    try {
      extraction = await extractFestivalFieldsFromEvidence({
        userQuery: query,
        sourceUrl: "combined-smart-research",
        pageTitle: query,
        excerpt: combinedEvidence,
        onModelUsed: (m) => { geminiModelUsed = m; },
      });
      providers_used.push("gemini");
    } catch (e) {
      warnings.push(`Gemini extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    warnings.push("No evidence collected from any provider.");
  }

  // Step 5: build sources list
  const sources: SmartResearchSource[] = [];
  if (aiOverviewText) {
    sources.push({
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      title: "Google AI Overview",
      domain: "google.com",
      snippet: aiOverviewText.slice(0, 300),
      is_ai_overview: true,
    });
  }
  for (const r of organic.slice(0, 6)) {
    sources.push({
      url: r.url,
      title: r.title,
      domain: domainFrom(r.url),
      snippet: r.snippet,
      is_ai_overview: false,
    });
  }

  // Step 6: assemble result. Gemini almost always returns null for hero_image
  // because cleanTextFromHtml strips <meta og:image>/<img> tags before the model
  // sees the evidence. We rely on:
  //   (a) SerpAPI image fields (knowledge_graph, inline_images, top_stories,
  //       organic thumbnails) — Google's curated picks, free from this response,
  //   (b) per-doc og:image / JSON-LD / <img> from fetched HTML pages.
  // If both yield zero we fire one fallback engine=google_images call.
  let candidates = pickTopImageCandidates(serpImageUrls, fetchedDocs, MAX_IMAGE_CANDIDATES);
  if (candidates.length === 0 && process.env.SERPAPI_KEY?.trim()) {
    try {
      const fallback = await serpApiImageSearch(query, MAX_IMAGE_CANDIDATES);
      if (fallback.length > 0) {
        candidates = pickTopImageCandidates(fallback, [], MAX_IMAGE_CANDIDATES);
        warnings.push(`Снимки взети от Google Images fallback (${fallback.length} резултата).`);
      } else {
        warnings.push("Google Images fallback: 0 резултата.");
      }
    } catch (e) {
      warnings.push(`Google Images fallback failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const fields: SmartResearchFields = {
    title: str(extraction?.title),
    start_date: str(extraction?.start_date),
    end_date: str(extraction?.end_date) ?? str(extraction?.start_date),
    start_time: str(extraction?.start_time),
    end_time: str(extraction?.end_time),
    city: str(extraction?.city),
    location_name: str(extraction?.location_name),
    address: str(extraction?.address),
    organizer_name: str(extraction?.organizer_name),
    organizer_names:
      Array.isArray(extraction?.organizer_names) && extraction.organizer_names.length > 0
        ? extraction.organizer_names.map((n) => str(n)).filter((n): n is string => n !== null)
        : null,
    description: str(extraction?.description),
    is_free: typeof extraction?.is_free === "boolean" ? extraction.is_free : null,
    category: str(extraction?.category),
    tags: Array.isArray(extraction?.tags) ? (extraction.tags as string[]) : [],
    website_url: str(extraction?.website_url),
    facebook_url: str(extraction?.facebook_url),
    instagram_url: str(extraction?.instagram_url),
    ticket_url: str(extraction?.ticket_url),
    hero_image_candidates: candidates,
    hero_image: str(extraction?.hero_image) ?? candidates[0] ?? null,
    program_draft: extraction?.program ? programDraftFromGeminiProgram(extraction.program) : null,
  };

  return {
    fields,
    sources,
    confidence: confidenceLevel(fields, sources.length),
    providers_used,
    warnings,
    gemini_model: geminiModelUsed,
  };
}
