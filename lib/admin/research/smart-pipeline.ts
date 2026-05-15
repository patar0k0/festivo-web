import "server-only";
import { serpApiSearch } from "@/lib/research/serpApiSearch";
import { researchFestival } from "@/lib/research/perplexity";
import { extractFestivalFieldsFromEvidence } from "@/lib/admin/research/gemini-extract";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { programDraftFromGeminiProgram } from "@/lib/festival/programDraft";
import type { ProgramDraft } from "@/lib/festival/programDraft";

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
  program_draft: ProgramDraft | null;
};

export type SmartResearchResult = {
  fields: SmartResearchFields;
  sources: SmartResearchSource[];
  confidence: "high" | "medium" | "low";
  providers_used: string[];
  warnings: string[];
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

export async function runSmartResearchPipeline(query: string): Promise<SmartResearchResult> {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY is not configured");

  const warnings: string[] = [];
  const providers_used: string[] = ["serpapi"];

  // Step 1: parallel SerpAPI calls (EN for AI Overview, BG for organic results)
  const [enResult, bgResult] = await Promise.all([
    serpApiSearch(query, "en").catch(() => ({ ai_overview_text: null, organic: [] })),
    serpApiSearch(query, "bg").catch(() => ({ ai_overview_text: null, organic: [] })),
  ]);

  const aiOverviewText = enResult.ai_overview_text;
  const organic = bgResult.organic;

  // Step 2: quality check — Perplexity fallback when results are thin
  const bgDomainCount = organic.filter((r) => r.url.toLowerCase().includes(".bg")).length;
  const hasGoodResults = Boolean(aiOverviewText) || bgDomainCount >= 3;

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
  for (const r of organic.slice(0, 5)) {
    if (r.snippet) {
      evidenceParts.push(`=== ${r.title ?? r.url} (${r.url}) ===\n${r.snippet}`);
    }
  }
  if (perplexityContext) {
    evidenceParts.push(`=== Perplexity Research ===\n${perplexityContext}`);
  }
  const combinedEvidence = evidenceParts.join("\n\n");

  // Step 4: single Gemini extraction call
  let extraction = null;
  if (combinedEvidence.trim()) {
    try {
      extraction = await extractFestivalFieldsFromEvidence({
        userQuery: query,
        sourceUrl: "combined-smart-research",
        pageTitle: query,
        excerpt: combinedEvidence,
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

  // Step 6: assemble result
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
    hero_image: str(extraction?.hero_image),
    program_draft: extraction?.program ? programDraftFromGeminiProgram(extraction.program) : null,
  };

  return {
    fields,
    sources,
    confidence: confidenceLevel(fields, sources.length),
    providers_used,
    warnings,
  };
}
