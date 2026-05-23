import type { ResearchLanguageSignal } from "@/lib/admin/research/types";

export type ExtractedSourceDocument = {
  url: string;
  domain: string;
  title: string;
  language: ResearchLanguageSignal;
  excerpt: string;
  /**
   * Best-guess hero image URL discovered in the page HTML (og:image, twitter:image,
   * link rel=image_src). May be a relative URL — caller should resolve against source URL.
   * Null when the page advertises no image. Extracted deterministically here because the
   * LLM never sees raw HTML; if we don't pluck it out manually the pipeline returns
   * `hero_image: null` even when the page has a perfectly good poster.
   */
  hero_image_candidate: string | null;
};

const MAX_TEXT_LENGTH = 5000;

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function detectLanguage(text: string): ResearchLanguageSignal {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (cyrillic > 0 && cyrillic >= latin) return "bg";
  if (cyrillic > 0) return "mixed";
  return "non_bg";
}

function cleanTextFromHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  const text = decodeHtmlEntities(withoutScripts.replace(/<[^>]+>/g, " "))
    .replace(/\b(login|sign in|register|cookie|accept all|menu|navigation|абонамент|вход|регистрация|бисквитки)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, MAX_TEXT_LENGTH);
}

function extractTitleFromHtml(html: string): string | null {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
  if (!title) return null;
  const cleaned = decodeHtmlEntities(title).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

/**
 * Extract the most reliable hero-image URL hint from a page's HTML.
 *
 * Priority order:
 *   1. <meta property="og:image"> — explicit social preview, almost always the best choice
 *   2. <meta property="og:image:secure_url"> — fallback variant
 *   3. <meta name="twitter:image"> — Twitter card
 *   4. <link rel="image_src"> — old standard, still used by some sites
 *
 * We intentionally do NOT scrape arbitrary <img> tags — they're usually icons,
 * tracking pixels, sidebar ads, or thumbnails that aren't representative.
 *
 * Returns the URL string as-found (may be relative; caller resolves against
 * the source URL). Returns null when no candidate is present.
 */
export function extractHeroImageCandidateFromHtml(html: string): string | null {
  // Matches all <meta …> and <link …> tags. We then probe each tag's
  // attribute string for the relevant property/name + content/href value.
  const PROPERTY_PATTERNS: ReadonlyArray<{
    tag: "meta" | "link";
    keyAttr: "property" | "name" | "rel";
    keyValue: string;
    contentAttr: "content" | "href";
  }> = [
    { tag: "meta", keyAttr: "property", keyValue: "og:image", contentAttr: "content" },
    { tag: "meta", keyAttr: "property", keyValue: "og:image:secure_url", contentAttr: "content" },
    { tag: "meta", keyAttr: "name", keyValue: "twitter:image", contentAttr: "content" },
    { tag: "meta", keyAttr: "name", keyValue: "twitter:image:src", contentAttr: "content" },
    { tag: "link", keyAttr: "rel", keyValue: "image_src", contentAttr: "href" },
  ];

  for (const { tag, keyAttr, keyValue, contentAttr } of PROPERTY_PATTERNS) {
    // Capture each tag's full attribute string lazily.
    const tagRegex = new RegExp(`<${tag}\\s+([^>]+?)\\s*/?>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(html)) !== null) {
      const attrs = match[1];
      // Quick key check before parsing content — both attributes order-agnostic.
      const keyRegex = new RegExp(`${keyAttr}\\s*=\\s*["']\\s*${keyValue}\\s*["']`, "i");
      if (!keyRegex.test(attrs)) continue;
      const contentRegex = new RegExp(`${contentAttr}\\s*=\\s*["']([^"']+)["']`, "i");
      const contentMatch = contentRegex.exec(attrs);
      const url = contentMatch?.[1]?.trim();
      if (url && url.length > 0 && url.length < 2000) {
        return decodeHtmlEntities(url);
      }
    }
  }

  return null;
}

/**
 * Resolve a possibly-relative image URL against the source page URL.
 * Returns null when the input is invalid or scheme-incompatible (file:, etc).
 */
export function resolveImageUrl(candidate: string | null, sourceUrl: string): string | null {
  if (!candidate) return null;
  try {
    const resolved = new URL(candidate, sourceUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

export async function fetchSourceDocument(url: string): Promise<ExtractedSourceDocument | null> {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;

  const response = await fetch(normalizedUrl, {
    method: "GET",
    headers: {
      "User-Agent": "festivo-research-bot/3.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response || !response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return null;

  const html = await response.text().catch(() => "");
  const excerpt = cleanTextFromHtml(html);
  if (!excerpt) return null;

  // Hero image must be extracted BEFORE cleanTextFromHtml strips all tags.
  // We resolve against the source URL so relative paths ("/uploads/poster.jpg")
  // become absolute and re-hostable by `rehostHeroImageFromUrl`.
  const heroCandidateRaw = extractHeroImageCandidateFromHtml(html);
  const hero_image_candidate = resolveImageUrl(heroCandidateRaw, normalizedUrl);

  return {
    url: normalizedUrl,
    domain: extractDomain(normalizedUrl),
    title: extractTitleFromHtml(html) ?? extractDomain(normalizedUrl),
    language: detectLanguage(excerpt),
    excerpt,
    hero_image_candidate,
  };
}
