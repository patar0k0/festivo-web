import type { ResearchSource } from "@/lib/admin/research/types";

export type ExtractedSourceDocument = {
  url: string;
  normalizedUrl: string;
  canonicalUrl: string | null;
  domain: string;
  title: string;
  description: string | null;
  ogImage: string | null;
  snippet: string;
  text: string;
  dateLike: string[];
  locationLike: string[];
  organizerLike: string[];
  isOfficial: boolean;
};

const FETCH_TIMEOUT_MS = 7000;
const MAX_HTML_LENGTH = 250_000;
const MAX_SNIPPET_LENGTH = 1800;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string): string {
  return collapseWhitespace(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

export function decodeHtmlEntities(value: string): string {
  const namedDecoded = value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return namedDecoded.replace(/&#(x?[0-9a-f]+);/giu, (match, codePoint) => {
    const parsed = codePoint.toLocaleLowerCase("en-US").startsWith("x")
      ? Number.parseInt(codePoint.slice(1), 16)
      : Number.parseInt(codePoint, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) return match;

    try {
      return String.fromCodePoint(parsed);
    } catch {
      return match;
    }
  }).replace(/&([a-z]+);/giu, (match, entityName) => NAMED_ENTITIES[entityName.toLocaleLowerCase("en-US")] ?? match);
}

function extractTagContent(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  const value = match?.[1];
  if (!value) return null;
  return collapseWhitespace(decodeHtmlEntities(value));
}

function extractMetaContent(html: string, attr: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta[^>]*${attr}=["']${escapedName}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${escapedName}["'][^>]*>`, "i");
  return extractTagContent(html, regex) ?? extractTagContent(html, reverseRegex);
}

function extractLinkHref(html: string, relName: string): string | null {
  const escapedName = relName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<link[^>]*rel=["'][^"']*${escapedName}[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>`, "i");
  const reverseRegex = new RegExp(`<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*${escapedName}[^"']*["'][^>]*>`, "i");
  return extractTagContent(html, regex) ?? extractTagContent(html, reverseRegex);
}

function absoluteUrl(candidate: string | null, base: string): string | null {
  if (!candidate) return null;

  try {
    return new URL(candidate, base).toString();
  } catch {
    return candidate;
  }
}

function collectMatches(text: string, regex: RegExp, max = 8): string[] {
  const values = new Set<string>();

  for (const match of text.matchAll(regex)) {
    const candidate = collapseWhitespace(match[1] ?? match[0] ?? "").replace(/[.,;]+$/, "");
    if (candidate) values.add(candidate);
    if (values.size >= max) break;
  }

  return [...values];
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";

    const removableTrackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "yclid",
      "mc_cid",
      "mc_eid",
    ];
    for (const key of removableTrackingParams) {
      parsed.searchParams.delete(key);
    }

    const downloadLike = ["download", "dl", "export", "attachment", "format", "output", "print"];
    const hasDownloadLikeQuery = [...parsed.searchParams.keys()].some((key) => downloadLike.includes(key.toLocaleLowerCase("en-US")));
    if (hasDownloadLikeQuery && parsed.pathname !== "/") {
      parsed.search = "";
    }

    if (parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1) || "/";
    }
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLocaleLowerCase("en-US");
  } catch {
    return "";
  }
}

export async function fetchSourceDocument(source: ResearchSource): Promise<ExtractedSourceDocument | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "festivo-research-bot/2.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const htmlRaw = await response.text();
    const html = htmlRaw.slice(0, MAX_HTML_LENGTH);

    const title =
      extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
      extractMetaContent(html, "property", "og:title") ??
      extractMetaContent(html, "name", "twitter:title") ??
      source.title;

    const description =
      extractMetaContent(html, "name", "description") ?? extractMetaContent(html, "property", "og:description") ?? null;

    const canonicalUrlRaw = absoluteUrl(extractLinkHref(html, "canonical"), source.url);
    const canonicalUrl = canonicalUrlRaw ? normalizeUrl(canonicalUrlRaw) : null;
    const ogImage = absoluteUrl(extractMetaContent(html, "property", "og:image"), source.url);
    const plainText = stripHtml(decodeHtmlEntities(html));

    const dateLike = collectMatches(
      plainText,
      /\b((?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2})\b/g,
    );
    const locationLike = collectMatches(
      plainText,
      /(?:локац(?:ия)?|location|venue|place|адрес|address|гр\.)\s*[:\-]?\s*([\p{L}\d"'\-\s,]{3,120})/giu,
    );
    const organizerLike = collectMatches(
      plainText,
      /(?:организатор|organizer|hosted by|presented by)\s*[:\-]?\s*([\p{L}\d"'\-\s.,]{3,120})/giu,
    );

    return {
      url: source.url,
      normalizedUrl: normalizeUrl(source.url),
      canonicalUrl,
      domain: source.domain,
      title: collapseWhitespace(decodeHtmlEntities(title)),
      description: description ? collapseWhitespace(decodeHtmlEntities(description)) : null,
      ogImage,
      snippet: plainText.slice(0, MAX_SNIPPET_LENGTH),
      text: plainText,
      dateLike,
      locationLike,
      organizerLike,
      isOfficial: source.is_official,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
