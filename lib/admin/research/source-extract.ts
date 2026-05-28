import type { ResearchLanguageSignal } from "@/lib/admin/research/types";

export type ExtractedSourceDocument = {
  url: string;
  domain: string;
  title: string;
  language: ResearchLanguageSignal;
  excerpt: string;
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

function metaContent(html: string, propertyOrName: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${propertyOrName.replace(/[.*+?^${}()|[\\]]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
  return content ? decodeHtmlEntities(content).trim() || null : null;
}

function resolveAbsoluteUrl(raw: string, baseUrl: string): string | null {
  try {
    const u = new URL(raw, baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function looksLikeUiAsset(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".ico")) return true;
  return /(?:sprite|icon|logo|favicon|placeholder|spinner|loader|avatar|emoji|gif\/?\?|tracking|pixel\.)/i.test(lower);
}

function extractImagesFromHtml(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const abs = resolveAbsoluteUrl(raw, baseUrl);
    if (!abs) return;
    if (abs.startsWith("data:")) return;
    if (looksLikeUiAsset(abs)) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };

  // 1) og:image / og:image:secure_url (highest priority — usually the page's hero)
  push(metaContent(html, "og:image"));
  push(metaContent(html, "og:image:secure_url"));
  push(metaContent(html, "twitter:image"));
  push(metaContent(html, "twitter:image:src"));

  // 2) JSON-LD schema.org image fields (Event, Article, etc.)
  const ldBlocks = html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of ldBlocks) {
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
    if (out.length >= MAX_IMAGES_PER_PAGE) break;
  }

  // 3) Body <img src> as fallback (filtered)
  if (out.length < MAX_IMAGES_PER_PAGE) {
    const imgTags = html.match(/<img\b[^>]+>/gi) ?? [];
    for (const tag of imgTags) {
      if (out.length >= MAX_IMAGES_PER_PAGE) break;
      const src =
        tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ??
        tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1] ??
        null;
      if (!src) continue;
      // skip obvious tiny / decorative
      const widthAttr = Number(tag.match(/\bwidth\s*=\s*["']?(\d+)/i)?.[1] ?? "0");
      const heightAttr = Number(tag.match(/\bheight\s*=\s*["']?(\d+)/i)?.[1] ?? "0");
      if ((widthAttr > 0 && widthAttr < 200) || (heightAttr > 0 && heightAttr < 200)) continue;
      push(src);
    }
  }

  return out;
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

  return {
    url: normalizedUrl,
    domain: extractDomain(normalizedUrl),
    title: extractTitleFromHtml(html) ?? extractDomain(normalizedUrl),
    language: detectLanguage(excerpt),
    excerpt,
    images: extractImagesFromHtml(html, normalizedUrl),
  };
}
