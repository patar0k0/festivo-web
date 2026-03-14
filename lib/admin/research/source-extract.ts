import type { ResearchSource } from "@/lib/admin/research/types";

export type ExtractedSourceDocument = {
  url: string;
  normalizedUrl: string;
  domain: string;
  title: string;
  description: string | null;
  snippet: string;
  ogImage: string | null;
  isOfficial: boolean;
};

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_LENGTH = 200_000;
const MAX_SNIPPET_LENGTH = 1200;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string): string {
  return collapseWhitespace(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTagContent(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  if (!match?.[1]) return null;
  return collapseWhitespace(decodeHtmlEntities(match[1]));
}

function extractMetaContent(html: string, attr: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta[^>]*${attr}=["']${escapedName}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${escapedName}["'][^>]*>`, "i");
  return extractTagContent(html, regex) ?? extractTagContent(html, reverseRegex);
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
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
        "User-Agent": "festivo-research-bot/1.0",
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
      source.title;

    const description =
      extractMetaContent(html, "name", "description") ?? extractMetaContent(html, "property", "og:description") ?? null;

    const ogImage = extractMetaContent(html, "property", "og:image");
    const snippet = stripHtml(decodeHtmlEntities(html)).slice(0, MAX_SNIPPET_LENGTH);

    return {
      url: source.url,
      normalizedUrl: normalizeUrl(source.url),
      domain: source.domain,
      title,
      description,
      snippet,
      ogImage,
      isOfficial: source.is_official,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
