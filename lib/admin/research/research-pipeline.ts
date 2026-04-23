import { extractFestivalFieldsFromEvidence, type GeminiRawExtraction } from "@/lib/admin/research/gemini-extract";
import { geminiGroundedSearchHits, isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { buildGeminiPipelineQueries } from "@/lib/admin/research/query-builder";
import { validatePipelineResult } from "@/lib/admin/research/pipeline-validate";
import { rankSearchHits, type SearchHit } from "@/lib/admin/research/search-hit-rank";
import { extractDomain, fetchSourceDocument } from "@/lib/admin/research/source-extract";
import { getSourceAuthorityTier } from "@/lib/admin/research/source-ranking";
import { normalizeResearchResult } from "@/lib/admin/research/normalize";
import { programDraftFromGeminiProgram, programDraftHasContent, type ProgramDraft } from "@/lib/festival/programDraft";
import type {
  ResearchCandidates,
  ResearchConfidence,
  ResearchConfidenceLevel,
  ResearchEvidence,
  ResearchFestivalResult,
  ResearchFieldCandidate,
  ResearchDateCandidate,
  ResearchSource,
} from "@/lib/admin/research/types";
import { normalizeFestivalSettlementType } from "@/lib/settlements/settlementType";

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function toSource(hit: SearchHit): ResearchSource {
  let domain = hit.url;
  try {
    domain = new URL(hit.url).hostname.replace(/^www\./i, "");
  } catch {
    /* ignore */
  }
  const tier = getSourceAuthorityTier({ url: hit.url, domain, title: hit.title });
  return {
    url: hit.url,
    domain,
    title: hit.title,
    is_official: tier === "tier1_official",
    tier,
    language: null,
  };
}

function mergeProgramDraftFromExtractions(rows: Array<{ rank: number; ex: GeminiRawExtraction }>): ProgramDraft | null {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  for (const row of sorted) {
    const draft = programDraftFromGeminiProgram(row.ex.program);
    if (draft && programDraftHasContent(draft)) return draft;
  }
  return null;
}

function mergeExtractions(
  rows: Array<{ url: string; rank: number; ex: GeminiRawExtraction }>,
  warnings: string[],
): {
  merged: GeminiRawExtraction;
  evidence: ResearchEvidence[];
  candidates: ResearchCandidates;
  conflictCount: number;
} {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);

  const mergedOrganizerNames: string[] = [];
  const pushOrg = (value: string | null) => {
    if (!value) return;
    if (mergedOrganizerNames.some((x) => x.toLocaleLowerCase("bg-BG") === value.toLocaleLowerCase("bg-BG"))) return;
    mergedOrganizerNames.push(value);
  };
  const mergedSettlementType = (() => {
    for (const row of sorted) {
      const t = normalizeFestivalSettlementType(row.ex.settlement_type);
      if (t) return t;
    }
    return null;
  })();

  for (const row of sorted) {
    const ex = row.ex;
    if (Array.isArray(ex.organizer_names)) {
      for (const n of ex.organizer_names) {
        pushOrg(str(n));
      }
    }
    pushOrg(str(ex.organizer_name));
  }

  const pickFirst = <K extends keyof GeminiRawExtraction>(key: K): GeminiRawExtraction[K] => {
    for (const row of sorted) {
      const v = row.ex[key];
      if (v === null || v === undefined) continue;
      if (key === "tags") {
        if (Array.isArray(v) && v.length > 0) return v as GeminiRawExtraction[K];
        continue;
      }
      if (typeof v === "string" && !str(v)) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      return v;
    }
    return null as GeminiRawExtraction[K];
  };

  const merged: GeminiRawExtraction = {
    title: str(pickFirst("title")),
    start_date: str(pickFirst("start_date")),
    end_date: str(pickFirst("end_date")),
    start_time: str(pickFirst("start_time")),
    end_time: str(pickFirst("end_time")),
    city: str(pickFirst("city")),
    location_name: str(pickFirst("location_name")),
    address: str(pickFirst("address")),
    organizer_name: mergedOrganizerNames[0] ?? str(pickFirst("organizer_name")),
    organizer_names: mergedOrganizerNames.length > 0 ? mergedOrganizerNames : null,
    description: str(pickFirst("description")),
    website_url: str(pickFirst("website_url")),
    facebook_url: str(pickFirst("facebook_url")),
    instagram_url: str(pickFirst("instagram_url")),
    ticket_url: str(pickFirst("ticket_url")),
    hero_image: str(pickFirst("hero_image")),
    is_free: (() => {
      for (const row of sorted) {
        if (typeof row.ex.is_free === "boolean") return row.ex.is_free;
      }
      return null;
    })(),
    category: str(pickFirst("category")),
    settlement_type: mergedSettlementType,
    tags: (() => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const row of sorted) {
        const t = row.ex.tags;
        if (!Array.isArray(t)) continue;
        for (const x of t) {
          if (typeof x !== "string") continue;
          const s = x.trim();
          if (!s || seen.has(s.toLowerCase())) continue;
          seen.add(s.toLowerCase());
          out.push(s);
          if (out.length >= 12) return out;
        }
      }
      return out;
    })(),
    program: (() => {
      for (const row of sorted) {
        const draft = programDraftFromGeminiProgram(row.ex.program);
        if (draft && programDraftHasContent(draft)) return row.ex.program;
      }
      return null;
    })(),
  };

  const conflictKeys: (keyof GeminiRawExtraction)[] = ["title", "city", "start_date", "end_date", "start_time", "end_time"];
  let conflictCount = 0;
  for (const k of conflictKeys) {
    const set = new Set<string>();
    for (const row of sorted) {
      const v = row.ex[k];
      const s = typeof v === "string" ? str(v) : null;
      if (s) set.add(s);
    }
    if (set.size > 1) {
      conflictCount += 1;
      warnings.push(`Conflicting ${String(k)} across ranked sources`);
    }
  }

  const evidence: ResearchEvidence[] = [];
  const fieldMap: Array<[keyof GeminiRawExtraction, string]> = [
    ["title", "title"],
    ["start_date", "start_date"],
    ["end_date", "end_date"],
    ["start_time", "start_time"],
    ["end_time", "end_time"],
    ["city", "city"],
    ["location_name", "location"],
    ["organizer_name", "organizer"],
    ["description", "description"],
    ["website_url", "website_url"],
    ["facebook_url", "facebook_url"],
    ["instagram_url", "instagram_url"],
    ["ticket_url", "ticket_url"],
    ["hero_image", "hero_image"],
    ["address", "address"],
    ["category", "category"],
  ];

  for (const [gk, evField] of fieldMap) {
    const mv = merged[gk];
    const mStr = typeof mv === "string" ? str(mv) : null;
    if (!mStr) continue;
    for (const row of sorted) {
      const rv = row.ex[gk];
      const rStr = typeof rv === "string" ? str(rv) : null;
      if (rStr === mStr) {
        evidence.push({ field: evField, value: mStr, source_url: row.url });
        break;
      }
    }
  }

  const candidates: ResearchCandidates = { titles: [], dates: [], cities: [], locations: [], organizers: [] };

  const addField = (target: ResearchFieldCandidate[], value: string, url: string, title: string, tier: ResearchSource["tier"]) => {
    if (!value) return;
    if (target.some((c) => c.value === value && c.source_url === url)) return;
    target.push({
      value,
      source_url: url,
      source_title: title,
      tier: tier ?? null,
      language: "bg",
      confidence: "medium",
    });
  };

  for (const row of sorted) {
    const e = row.ex;
    const domain = extractDomain(row.url) ?? row.url;
    const tier = getSourceAuthorityTier({ url: row.url, domain, title: str(e.title) ?? domain });
    if (str(e.title)) addField(candidates.titles, str(e.title)!, row.url, str(e.title)!, tier);
    if (str(e.city)) addField(candidates.cities, str(e.city)!, row.url, str(e.city)!, tier);
    if (str(e.location_name)) addField(candidates.locations, str(e.location_name)!, row.url, str(e.location_name)!, tier);
    {
      const rowOrg: string[] = [];
      if (Array.isArray(e.organizer_names)) {
        for (const n of e.organizer_names) {
          const s = str(n);
          if (s) rowOrg.push(s);
        }
      }
      if (str(e.organizer_name)) rowOrg.push(str(e.organizer_name)!);
      const seenRow = new Set<string>();
      for (const name of rowOrg) {
        const k = name.toLocaleLowerCase("bg-BG");
        if (seenRow.has(k)) continue;
        seenRow.add(k);
        addField(candidates.organizers, name, row.url, str(e.title)!, tier);
      }
    }
    const sd = str(e.start_date);
    const ed = str(e.end_date);
    if (sd || ed) {
      const dc: ResearchDateCandidate = {
        start_date: sd,
        end_date: ed ?? sd,
        source_url: row.url,
        source_title: row.url,
        tier,
        language: "bg",
        label: sd && ed ? (sd === ed ? sd : `${sd} → ${ed}`) : sd ?? ed,
      };
      if (!candidates.dates.some((d) => d.source_url === row.url && d.start_date === dc.start_date && d.end_date === dc.end_date)) {
        candidates.dates.push(dc);
      }
    }
  }

  return { merged, evidence, candidates, conflictCount };
}

function confidenceFromState(args: {
  conflictWarnings: number;
  sourceTier1: boolean;
  hasDates: boolean;
  hasTitle: boolean;
}): ResearchConfidenceLevel {
  const { conflictWarnings, sourceTier1, hasDates, hasTitle } = args;
  if (conflictWarnings >= 2) return "low";
  if (sourceTier1 && hasDates && hasTitle && conflictWarnings === 0) return "high";
  if (hasTitle && (hasDates || conflictWarnings === 0)) return "medium";
  return "low";
}

function buildConfidence(overall: ResearchConfidenceLevel): ResearchConfidence {
  return {
    overall,
    title: overall,
    dates: overall,
    city: overall,
    location: overall,
    description: overall,
    organizer: overall,
    hero_image: overall,
    is_free: overall,
  };
}

export async function runGeminiResearchPipeline(userQuery: string): Promise<ResearchFestivalResult> {
  const query = userQuery.trim();
  const normalized_query = query.toLocaleLowerCase("bg-BG");
  const warnings: string[] = [];

  if (!isGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const searchQueries = buildGeminiPipelineQueries(query);
  const hitMap = new Map<string, SearchHit>();

  const minSourcesBeforeStop = 5;
  for (const sq of searchQueries) {
    if (hitMap.size >= minSourcesBeforeStop) break;
    try {
      const hits = await geminiGroundedSearchHits(sq);
      for (const h of hits) {
        if (!hitMap.has(h.url)) hitMap.set(h.url, h);
      }
    } catch (e) {
      warnings.push(`Grounded search failed for «${sq}»: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const allHits = [...hitMap.values()];
  if (allHits.length === 0) {
    return normalizeResearchResult({
      query,
      normalized_query,
      best_guess: {
        title: null,
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        city: null,
        location: null,
        organizers: [],
        organizer: null,
        description: null,
        hero_image: null,
        tags: [],
        is_free: null,
        program_draft: null,
        settlement_type: null,
      },
      candidates: { titles: [], dates: [], cities: [], locations: [], organizers: [] },
      sources: [],
      confidence: buildConfidence("low"),
      warnings: [...warnings, "No web results from Gemini grounding."],
      evidence: [],
      metadata: {
        provider: "gemini_pipeline",
        mode: "gemini_multi_step",
        source_count: 0,
        fallback_used: true,
      },
    });
  }

  const ranked = rankSearchHits(allHits, query, 5);
  const sources = ranked.map(toSource);

  const extractionRows: Array<{ url: string; rank: number; ex: GeminiRawExtraction }> = [];

  for (let i = 0; i < ranked.length; i++) {
    const hit = ranked[i]!;
    const doc = await fetchSourceDocument(hit.url).catch(() => null);
    if (!doc?.excerpt || doc.excerpt.length < 80) {
      warnings.push(`Little or no page text for ${hit.url}`);
      continue;
    }
    try {
      const ex = await extractFestivalFieldsFromEvidence({
        userQuery: query,
        sourceUrl: hit.url,
        pageTitle: doc.title || hit.title,
        excerpt: doc.excerpt,
      });
      extractionRows.push({ url: hit.url, rank: i, ex });
    } catch (e) {
      warnings.push(`Extraction failed for ${hit.url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (extractionRows.length === 0) {
    const top = ranked[0]!;
    return normalizeResearchResult({
      query,
      normalized_query,
      best_guess: {
        title: str(top.title) ?? null,
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        city: null,
        location: null,
        organizers: [],
        organizer: null,
        description: null,
        hero_image: null,
        tags: [],
        is_free: null,
        website_url: null,
        facebook_url: null,
        instagram_url: null,
        ticket_url: null,
        address: null,
        category: null,
        program_draft: null,
        settlement_type: null,
      },
      candidates: { titles: [], dates: [], cities: [], locations: [], organizers: [] },
      sources,
      confidence: buildConfidence("low"),
      warnings: [...warnings, "Could not extract structured fields from top sources."],
      evidence: [],
      metadata: {
        provider: "gemini_pipeline",
        mode: "gemini_multi_step",
        source_count: sources.length,
        fallback_used: true,
      },
    });
  }

  const { merged, evidence, candidates, conflictCount: conflictWarnings } = mergeExtractions(extractionRows, warnings);
  const programDraftMerged = mergeProgramDraftFromExtractions(extractionRows);

  const tier1 = sources.some((s) => s.tier === "tier1_official");
  const overallConf = confidenceFromState({
    conflictWarnings,
    sourceTier1: tier1,
    hasDates: Boolean(merged.start_date && merged.end_date),
    hasTitle: Boolean(str(merged.title)),
  });

  const raw: ResearchFestivalResult = {
    query,
    normalized_query,
    best_guess: {
      title: str(merged.title),
      start_date: str(merged.start_date),
      end_date: str(merged.end_date) ?? str(merged.start_date),
      start_time: str(merged.start_time),
      end_time: str(merged.end_time),
      city: str(merged.city),
      location: str(merged.location_name),
      organizers: Array.isArray(merged.organizer_names)
        ? merged.organizer_names.map((n) => str(n)).filter((n): n is string => Boolean(n))
        : merged.organizer_name
          ? [str(merged.organizer_name)!]
          : [],
      organizer: str(merged.organizer_name),
      description: str(merged.description),
      hero_image: str(merged.hero_image),
      tags: Array.isArray(merged.tags) ? merged.tags : [],
      is_free: merged.is_free,
      website_url: str(merged.website_url),
      facebook_url: str(merged.facebook_url),
      instagram_url: str(merged.instagram_url),
      ticket_url: str(merged.ticket_url),
      address: str(merged.address),
      category: str(merged.category),
      program_draft: programDraftMerged,
      settlement_type: normalizeFestivalSettlementType(merged.settlement_type),
    },
    candidates,
    sources,
    confidence: buildConfidence(overallConf),
    warnings,
    evidence,
    metadata: {
      provider: "gemini_pipeline",
      mode: "gemini_multi_step",
      source_count: sources.length,
      model: process.env.GEMINI_RESEARCH_MODEL?.trim() || "gemini-2.0-flash",
      fallback_used: false,
    },
    title: str(merged.title),
    start_date: str(merged.start_date),
    end_date: str(merged.end_date) ?? str(merged.start_date),
    start_time: str(merged.start_time),
    end_time: str(merged.end_time),
    city: str(merged.city),
    location: str(merged.location_name),
    description: str(merged.description),
    organizer: str(merged.organizer_name),
    organizers: Array.isArray(merged.organizer_names)
      ? merged.organizer_names.map((n) => str(n)).filter((n): n is string => Boolean(n))
      : merged.organizer_name
        ? [str(merged.organizer_name)!]
        : [],
    hero_image: str(merged.hero_image),
    tags: Array.isArray(merged.tags) ? merged.tags : [],
    is_free: merged.is_free,
    program_draft: programDraftMerged,
    settlement_type: normalizeFestivalSettlementType(merged.settlement_type),
  };

  const validated = validatePipelineResult(raw);
  raw.warnings = validated.warnings;
  if (validated.rejected) {
    raw.confidence = buildConfidence("low");
  }

  return normalizeResearchResult(raw);
}
