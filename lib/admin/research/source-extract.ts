import type { ResearchLanguageSignal } from "@/lib/admin/research/types";

export type ExtractedSourceDocument = {
  url: string;
  domain: string;
  title: string;
  language: ResearchLanguageSignal;
  excerpt: string;
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
  };
}
