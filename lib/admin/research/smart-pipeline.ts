import "server-only";
import { serpApiSearch, serpApiImageSearch } from "@/lib/research/serpApiSearch";
import { googleCseImageSearch, isGoogleCseConfigured } from "@/lib/research/googleImageSearch";
import { rerankImageCandidates } from "@/lib/admin/research/imageReranker";
import { researchFestival } from "@/lib/research/perplexity";
import { extractFestivalFieldsFromEvidence } from "@/lib/admin/research/gemini-extract";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { listActiveFestivalCategories } from "@/lib/festivals/categories.server";
import { fetchSourceDocument } from "@/lib/admin/research/source-extract";
import { programDraftFromGeminiProgram } from "@/lib/festival/programDraft";
import type { ProgramDraft } from "@/lib/festival/programDraft";

/**
 * Конкурентни сайтове-агрегатори: пускаме fetch (защото og:image-ите им
 * обикновено сочат към реалната корица — взети от FB), но **excerpt-ът** им
 * НЕ влиза в Gemini evidence. Не искаме описанията / датите от платформите
 * им да формират нашите фестивални полета.
 */
const TEXT_EVIDENCE_BLOCKLIST = new Set([
  "eventibg.com",
  "festivali.eu",
]);

function shouldUseDocForTextEvidence(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return !TEXT_EVIDENCE_BLOCKLIST.has(host);
  } catch {
    return true;
  }
}

/**
 * Домейни, от които е безсмислено да извличаме пълно съдържание.
 *
 * Facebook / Instagram умишлено НЕ са в списъка — голяма част от българските
 * фестивали имат FB event page като официална страница и og:image е реалната
 * корица. `fetchSourceDocument` използва `facebookexternalhit/1.1` UA за тези
 * сайтове, който задължава мета социалните мрежи да върнат пълно server-rendered
 * HTML с Open Graph мета тагове (документиран Facebook crawler протокол).
 */
const SKIP_FETCH_DOMAINS = new Set([
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

const MAX_IMAGE_CANDIDATES = 6;

export type SmartResearchStepId = "serpapi" | "perplexity" | "gemini" | "images";
export type SmartResearchStepStatus = "running" | "done" | "skipped" | "error";

/** Real-time progress callback so the API can stream pipeline stages to the UI. */
export type SmartResearchProgress = (
  step: SmartResearchStepId,
  status: SmartResearchStepStatus,
  detail?: string,
) => void;

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

/** Returns true when the ISO date string is strictly before today (Europe/Sofia-ish, date-only). */
function isPastIsoDate(iso: string | null): boolean {
  if (!iso) return false;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  return `${m[1]}-${m[2]}-${m[3]}` < todayStr;
}

/**
 * Confidence scoring. Beyond counting filled core fields, we apply two
 * forward-looking-catalog penalties:
 *   - missing start_date → cap at "low" (a dateless festival isn't actionable)
 *   - past start_date → cap at "medium" (likely a stale/previous-edition match)
 * Notes are surfaced to the admin panel as warnings.
 */
function confidenceLevel(
  fields: SmartResearchFields,
  sourcesCount: number,
): { level: "high" | "medium" | "low"; notes: string[] } {
  const notes: string[] = [];
  const filled = [fields.title, fields.start_date, fields.city, fields.organizer_name].filter(Boolean).length;

  let level: "high" | "medium" | "low";
  if (filled >= 3 && sourcesCount >= 2) level = "high";
  else if (filled >= 2) level = "medium";
  else level = "low";

  if (!fields.start_date) {
    if (level !== "low") notes.push("Без открита дата — увереността е свалена.");
    level = "low";
  } else if (isPastIsoDate(fields.start_date)) {
    notes.push("Откритата дата е в миналото — възможно е да е стар/предишен event. Провери годината.");
    if (level === "high") level = "medium";
  }

  return { level, notes };
}

function looksLikeRealImageUrl(url: string): boolean {
  return (
    /\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(url) ||
    /\/(image|img|photo|media|upload|cdn|tbn|images)\b/i.test(url) ||
    /encrypted-tbn|gstatic\.com|fbcdn\.net|cdninstagram|ytimg\.com/i.test(url)
  );
}

/**
 * Round-robin picker across multiple image sources.
 *
 * Returns up to `max` unique image URLs by taking one from each source in turn,
 * cycling through until full. Ensures the candidate set reflects diverse origins
 * — if one source (e.g. SerpAPI's proxied thumbnails) is broken at render time,
 * the other sources still contribute working alternatives.
 *
 * The first non-image-looking candidate per cycle is always kept as a last
 * resort so the UI has at least one preview — `rehostHeroImageFromUrl`
 * validates content-type when it downloads server-side anyway.
 */
function pickTopImageCandidates(
  sources: ReadonlyArray<ReadonlyArray<string>>,
  max = MAX_IMAGE_CANDIDATES,
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  const cursors = sources.map(() => 0);

  // Pass 1: round-robin one at a time across sources
  while (results.length < max) {
    let addedThisRound = false;
    for (let i = 0; i < sources.length && results.length < max; i++) {
      const src = sources[i] ?? [];
      while (cursors[i]! < src.length) {
        const url = src[cursors[i]!]!;
        cursors[i]!++;
        if (seen.has(url)) continue;
        seen.add(url);
        if (looksLikeRealImageUrl(url) || results.length === 0) {
          results.push(url);
          addedThisRound = true;
          break;
        }
      }
    }
    if (!addedThisRound) break;
  }
  return results;
}

export async function runSmartResearchPipeline(
  query: string,
  onProgress?: SmartResearchProgress,
): Promise<SmartResearchResult> {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY is not configured");

  // Safe no-op wrapper so progress reporting never throws into the pipeline.
  const progress: SmartResearchProgress = (step, status, detail) => {
    try {
      onProgress?.(step, status, detail);
    } catch {
      /* ignore progress sink errors */
    }
  };

  const warnings: string[] = [];
  const providers_used: string[] = ["serpapi"];

  // Step 1: 4 parallel SerpAPI calls
  //  - EN regular search → AI Overview text
  //  - BG regular search → organic results (for fetching) + image URLs
  //  - google_images BG (full query) → guaranteed image candidates
  //  - google_images BG (short query, year stripped) → fallback for niche/future festivals
  //    where the full specific query yields 0 images in Google Images index
  //    (e.g. "Фестивал на хороигралците 'Харизмата на хорото' 2026" → try "Харизмата на хорото")
  // 2 SerpAPI кредита на търсене: 1× BG organic + 1× Google Images.
  // Google CSE (ако е конфигуриран) върви паралелно като допълнителен image
  // източник с imgSize=large&imgType=photo — по-качествени корици от thumbnails.
  progress("serpapi", "running");
  const [bgResult, gImageResult, cseImages] = await Promise.all([
    serpApiSearch(query, "bg").catch(() => ({ ai_overview_text: null, organic: [], image_urls: [], warning: "SerpAPI заявка хвърли изключение." })),
    serpApiImageSearch(query, 8).catch(() => [] as string[]),
    googleCseImageSearch(query, 8).catch(() => [] as string[]),
  ]);

  if (bgResult.warning) warnings.push(bgResult.warning);

  const aiOverviewText = bgResult.ai_overview_text;
  const organic = bgResult.organic;

  progress(
    "serpapi",
    bgResult.warning ? "error" : "done",
    aiOverviewText ? "AI Overview намерен" : `${organic.length} резултата`,
  );

  const gImageResultMerged: string[] = [...gImageResult];

  // SerpAPI inline images from the BG regular search (knowledge_graph, inline_images, etc.)
  const serpInlineImages: string[] = [...bgResult.image_urls];

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
    progress("perplexity", "running");
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
        progress("perplexity", "done", "добавен контекст");
      } else {
        progress("perplexity", "skipped", "няма допълнителни данни");
      }
    } catch (e) {
      warnings.push(`Perplexity fallback failed: ${e instanceof Error ? e.message : String(e)}`);
      progress("perplexity", "error");
    }
  } else {
    progress("perplexity", "skipped", "пропуснат (достатъчно резултати)");
  }

  // Step 3: build combined evidence for Gemini
  const evidenceParts: string[] = [];
  if (aiOverviewText) {
    evidenceParts.push(`=== Google AI Overview ===\n${aiOverviewText}`);
  }

  const fetchedUrls = new Set(fetchedDocs.map((d) => d.url));
  let skippedEvidenceCount = 0;
  for (const doc of fetchedDocs) {
    if (!shouldUseDocForTextEvidence(doc.url)) {
      skippedEvidenceCount += 1;
      continue;
    }
    evidenceParts.push(`=== ${doc.title} (${doc.url}) ===\n${doc.excerpt}`);
  }
  if (skippedEvidenceCount > 0) {
    warnings.push(`${skippedEvidenceCount} конкурентни източника пропуснати от Gemini evidence (но снимките им остават).`);
  }

  for (const r of organic.slice(0, 6)) {
    if (!fetchedUrls.has(r.url) && r.snippet && shouldUseDocForTextEvidence(r.url)) {
      evidenceParts.push(`=== ${r.title ?? r.url} (${r.url}) ===\n${r.snippet}`);
    }
  }

  if (perplexityContext) {
    evidenceParts.push(`=== Perplexity Research ===\n${perplexityContext}`);
  }
  const combinedEvidence = evidenceParts.join("\n\n");

  // Step 4: single Gemini extraction call
  const activeCategories = await listActiveFestivalCategories();
  const categorySlugs = activeCategories.map((c) => c.slug);

  let extraction = null;
  let geminiModelUsed: string | null = null;
  if (combinedEvidence.trim()) {
    progress("gemini", "running");
    try {
      extraction = await extractFestivalFieldsFromEvidence({
        userQuery: query,
        sourceUrl: "combined-smart-research",
        pageTitle: query,
        excerpt: combinedEvidence,
        onModelUsed: (m) => { geminiModelUsed = m; },
        categories: categorySlugs,
      });
      providers_used.push("gemini");
      progress("gemini", "done", geminiModelUsed ?? undefined);
    } catch (e) {
      warnings.push(`Gemini extraction failed: ${e instanceof Error ? e.message : String(e)}`);
      progress("gemini", "error");
    }
  } else {
    warnings.push("No evidence collected from any provider.");
    progress("gemini", "skipped", "няма evidence");
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
  // sees the evidence. We round-robin three deterministic sources so the
  // candidate set is diverse (one source breaking in the browser doesn't kill
  // the whole feature):
  //   (a) per-doc og:image / JSON-LD / <img> from fetched HTML pages (real
  //       BG event sites — often the most accurate cover)
  //   (b) Google CSE large photos (imgSize=large&imgType=photo) — high quality
  //   (c) engine=google_images (Google CDN thumbs via SerpAPI proxy)
  //   (d) SerpAPI regular search inline_images / knowledge_graph
  // Per-doc goes first because BG sites (when they don't hotlink-block) give
  // the actual festival's hero image; CSE large photos are the next best.
  const perDocImages: string[] = [];
  for (const doc of fetchedDocs) {
    for (const img of doc.images) perDocImages.push(img);
  }
  let candidates = pickTopImageCandidates(
    [perDocImages, cseImages, gImageResultMerged, serpInlineImages],
    MAX_IMAGE_CANDIDATES,
  );

  // Always emit a diagnostic so admins can see which source contributed (or didn't).
  const cseNote = isGoogleCseConfigured() ? `${cseImages.length}` : "изкл.";
  warnings.push(
    `Снимки: страници=${perDocImages.length}, cse=${cseNote}, google_images=${gImageResult.length}, serp=${serpInlineImages.length} → избрани ${candidates.length}.`,
  );

  // Step 7: AI vision rerank — score candidates by how well they represent this
  // festival and reorder so the best real cover is first, junk (logos/maps) last.
  // Kill-switch: SMART_RESEARCH_IMAGE_RERANK=0. Best-effort; failures keep order.
  const rerankTitle = str(extraction?.title) ?? query;
  if (process.env.SMART_RESEARCH_IMAGE_RERANK !== "0" && candidates.length > 1) {
    progress("images", "running");
    const reranked = await rerankImageCandidates({
      candidates,
      title: rerankTitle,
      city: str(extraction?.city),
    });
    candidates = reranked.ordered;
    warnings.push(...reranked.notes);
    progress("images", "done", reranked.notes[0]);
  } else {
    progress("images", "skipped", candidates.length <= 1 ? "няма какво да се подрежда" : "изключен");
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

  const { level: confidence, notes: confidenceNotes } = confidenceLevel(fields, sources.length);
  warnings.push(...confidenceNotes);

  return {
    fields,
    sources,
    confidence,
    providers_used,
    warnings,
    gemini_model: geminiModelUsed,
  };
}
