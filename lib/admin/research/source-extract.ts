import type { ResearchLanguageSignal } from "@/lib/admin/research/types";

export type ExtractedSourceDocument = {
  url: string;
  domain: string;
  title: string;
  language: ResearchLanguageSignal;
  excerpt: string;
  /**
   * Ordered list of absolute image URLs discovered in the page HTML.
   * Priority: og:image → og:image:secure_url → twitter:image → twitter:image:src →
   * link rel=image_src → JSON-LD schema.org (Event.image / thumbnailUrl / contentUrl) →
   * filtered <img src> fallback.
   * `images[0]` is the best hero candidate; subsequent entries are gallery candidates.
   * Extracted deterministically here because the LLM never sees raw HTML; if we don't
   * pluck these out manually the pipeline returns `hero_image: null` even when the page
   * has perfectly good posters.
   */
  images: string[];
};

const MAX_TEXT_LENGTH = 5000;
const MAX_IMAGES_PER_PAGE = 5;

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
  const cyrillic = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
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
 * Resolve a possibly-relative image URL against the source page URL.
 * Returns null when the input is invalid or scheme-incompatible (file:, data:, etc).
 */
export function resolveImageUrl(candidate: string | null, sourceUrl: string): string | null {
  if (!candidate) return null;
  try {
    const resolved = new URL(candidate, sourceUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Extract the highest-priority hero-image URL hint from a page's HTML.
 * Used by callers that only need a single best guess.
 *
 * Priority: og:image → og:image:secure_url → twitter:image → twitter:image:src → link rel=image_src.
 */
export function extractHeroImageCandidateFromHtml(html: string): string | null {
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
    const tagRegex = new RegExp(`<${tag}\\s+([^>]+?)\\s*/?>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(html)) !== null) {
      const attrs = match[1] ?? "";
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

function looksLikeUiAsset(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".ico")) return true;
  return /(?:sprite|icon|logo|favicon|placeholder|spinner|loader|avatar|emoji|gif\/?\?|tracking|pixel\.)/i.test(lower);
}

/**
 * Walks the HTML for all plausible image URLs in priority order:
 *   1. og:image / og:image:secure_url / twitter:image / link rel=image_src (the hero)
 *   2. JSON-LD schema.org Event.image / thumbnailUrl / contentUrl
 *   3. Body <img src>/<img data-src> with size filters (skip < 200px decorative thumbs)
 *
 * Deduplicates by absolute URL, skips data:/svg/icon/favicon/tracker URLs,
 * caps the result at MAX_IMAGES_PER_PAGE.
 */
function extractImagesFromHtml(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    if (out.length >= MAX_IMAGES_PER_PAGE) return;
    const abs = resolveImageUrl(raw, baseUrl);
    if (!abs) return;
    if (looksLikeUiAsset(abs)) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };

  // 1) Highest-priority hero meta tags (in declared order)
  push(extractHeroImageCandidateFromHtml(html));

  // 2) JSON-LD schema.org image fields (Event, Article, ImageObject, etc.)
  const ldBlocks = html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of ldBlocks) {
    if (out.length >= MAX_IMAGES_PER_PAGE) break;
    const jsonText = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      continue;
    }
    const queue: unknown[] = [parsed];
    while (queue.length > 0 && out.length < MAX_IMAGES_PER_PAGE) {
      const node = queue.shift();
      if (!node) continue;
      if (typeof node === "string") {
        if (/^https?:\/\//i.test(node) && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(node)) push(node);
        continue;
      }
      if (Array.isArray(node)) {
        for (const item of node) queue.push(item);
        continue;
      }
      if (typeof node === "object") {
        const obj = node as Record<string, unknown>;
        if ("image" in obj) queue.push(obj.image);
        if ("url" in obj && typeof obj.url === "string" && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(obj.url)) push(obj.url);
        if ("thumbnailUrl" in obj) queue.push(obj.thumbnailUrl);
        if ("contentUrl" in obj) queue.push(obj.contentUrl);
      }
    }
  }

  // 3) Body <img src> fallback (filtered)
  if (out.length < MAX_IMAGES_PER_PAGE) {
    const imgTags = html.match(/<img\b[^>]+>/gi) ?? [];
    for (const tag of imgTags) {
      if (out.length >= MAX_IMAGES_PER_PAGE) break;
      const src =
        tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ??
        tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1] ??
        null;
      if (!src) continue;
      const widthAttr = Number(tag.match(/\bwidth\s*=\s*["']?(\d+)/i)?.[1] ?? "0");
      const heightAttr = Number(tag.match(/\bheight\s*=\s*["']?(\d+)/i)?.[1] ?? "0");
      if ((widthAttr > 0 && widthAttr < 200) || (heightAttr > 0 && heightAttr < 200)) continue;
      push(src);
    }
  }

  return out;
}

/**
 * Picks the right User-Agent for the target host.
 *
 * For Facebook / Instagram we use `facebookexternalhit/1.1` — Facebook's own
 * social card crawler UA. The official Meta documentation guarantees that pages
 * served to this UA include full Open Graph `<meta>` tags (otherwise FB couldn't
 * generate previews when its own content is shared on third-party sites). Most
 * private pages still 302 to login, but public event pages render full HTML
 * with `og:image` pointing at the cover photo.
 *
 * For everything else we send a real Chrome UA — almost every BG site rejects
 * obvious bot UAs with 403 / login redirects, hiding the og:image meta we need.
 */
function pickUserAgent(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    /* fall through to default */
  }
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "instagram.com" || host.endsWith(".instagram.com")) {
    // Combined identification — declares both our bot and the social crawler
    // identity Meta expects. Avoids pure impersonation while still getting the
    // crawler-grade HTML response.
    return "Mozilla/5.0 (compatible; festivo-bot/3.0; +https://festivo.bg/bot) facebookexternalhit/1.1";
  }
  return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
}

export async function fetchSourceDocument(url: string): Promise<ExtractedSourceDocument | null> {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;

  const response = await fetch(normalizedUrl, {
    method: "GET",
    headers: {
      "User-Agent": pickUserAgent(normalizedUrl),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "bg,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response || !response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return null;

  const html = await response.text().catch(() => "");
  const excerpt = cleanTextFromHtml(html);
  if (!excerpt) return null;

  // Images must be extracted BEFORE cleanTextFromHtml strips all tags (already done above
  // — `html` retained for both passes).
  const images = extractImagesFromHtml(html, normalizedUrl);

  return {
    url: normalizedUrl,
    domain: extractDomain(normalizedUrl),
    title: extractTitleFromHtml(html) ?? extractDomain(normalizedUrl),
    language: detectLanguage(excerpt),
    excerpt,
    images,
  };
}
