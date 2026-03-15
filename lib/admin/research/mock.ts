import type { ResearchFestivalResult } from "@/lib/admin/research/types";

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("bg-BG");
}

export async function runMockResearch(query: string): Promise<ResearchFestivalResult> {
  const normalized = normalizeQuery(query);

  if (normalized.includes("сурва 2026") || normalized.includes("surva 2026")) {
    return {
      query,
      normalized_query: normalized,
      best_guess: {
        title: "Международен фестивал на маскарадните игри „Сурва 2026“",
        start_date: "2026-01-16",
        end_date: "2026-01-25",
        city: "Перник",
        location: "Централна градска част на Перник",
        description: "Сурва е международен фестивал на маскарадните игри в Перник, включващ дефилета, конкурсна програма и съпътстващи културни събития.",
        organizer: "Община Перник",
        hero_image: null,
        tags: ["маскарадни игри", "традиции", "фолклор", "зима"],
      },
      candidates: {
        titles: [
          { value: "Международен фестивал на маскарадните игри „Сурва 2026“", source_url: "https://surva.org/", tier: "tier1_official", language: "bg" },
        ],
        dates: [
          { start_date: "2026-01-16", end_date: "2026-01-25", source_url: "https://surva.org/", tier: "tier1_official", language: "bg", label: "2026-01-16 → 2026-01-25" },
        ],
        cities: [{ value: "Перник", source_url: "https://surva.org/", tier: "tier1_official", language: "bg" }],
        locations: [{ value: "Централна градска част на Перник", source_url: "https://surva.org/", tier: "tier1_official", language: "bg" }],
        organizers: [{ value: "Община Перник", source_url: "https://surva.org/", tier: "tier1_official", language: "bg" }],
      },
      sources: [
        { url: "https://surva.org/", domain: "surva.org", title: "Official site", is_official: true },
        { url: "https://visitpernik.com/", domain: "visitpernik.com", title: "Tourism portal", is_official: false },
      ],
      confidence: {
        overall: "high",
        title: "high",
        dates: "high",
        city: "high",
        location: "medium",
        description: "medium",
        organizer: "medium",
        hero_image: "low",
      },
      warnings: [],
      evidence: [
        { field: "title", value: "Международен фестивал на маскарадните игри „Сурва 2026“", source_url: "https://surva.org/" },
        { field: "dates", value: "2026-01-16 до 2026-01-25", source_url: "https://surva.org/" },
      ],
      metadata: { provider: "mock", mode: "special_case_mock", source_count: 2 },
    };
  }

  return {
    query,
    normalized_query: normalized,
    best_guess: {
      title: query.trim() || "Unknown festival",
      start_date: null,
      end_date: null,
      city: null,
      location: null,
      description: null,
      organizer: null,
      hero_image: null,
      tags: [],
    },
    candidates: { titles: [], dates: [], cities: [], locations: [], organizers: [] },
    sources: [],
    confidence: {
      overall: "low",
      title: "low",
      dates: "low",
      city: "low",
      location: "low",
      description: "low",
      organizer: "low",
      hero_image: "low",
    },
    warnings: ["Mock provider has limited knowledge for this query."],
    evidence: [],
    metadata: { provider: "mock", mode: "generic_mock", source_count: 0 },
  };
}
