import type { SourceAuthorityTier } from "@/lib/admin/research/source-ranking";

export type ResearchConfidenceLevel = "high" | "medium" | "low";
export type ResearchLanguageSignal = "bg" | "mixed" | "non_bg";

export type ResearchSource = {
  url: string;
  domain: string;
  title: string;
  is_official: boolean;
  tier?: SourceAuthorityTier | null;
  language?: ResearchLanguageSignal | null;
};

export type ResearchEvidence = {
  field: string;
  value: string;
  source_url: string;
};

export type ResearchFieldCandidate = {
  value: string;
  source_url: string;
  source_title?: string | null;
  tier: SourceAuthorityTier | null;
  language: ResearchLanguageSignal | null;
  confidence?: ResearchConfidenceLevel | null;
  reason?: string | null;
};

export type ResearchDateCandidate = {
  start_date: string;
  end_date: string;
  source_url: string;
  source_title?: string | null;
  tier: SourceAuthorityTier | null;
  language: ResearchLanguageSignal | null;
  confidence?: ResearchConfidenceLevel | null;
  reason?: string | null;
  label: string;
};

export type ResearchCandidates = {
  titles: ResearchFieldCandidate[];
  dates: ResearchDateCandidate[];
  cities: ResearchFieldCandidate[];
  locations: ResearchFieldCandidate[];
  organizers: ResearchFieldCandidate[];
};

export type ResearchBestGuess = {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  location: string | null;
  organizer: string | null;
  description: string | null;
  hero_image: string | null;
  tags: string[];
};

export type ResearchConfidence = {
  overall: ResearchConfidenceLevel;
  title: ResearchConfidenceLevel;
  dates: ResearchConfidenceLevel;
  city: ResearchConfidenceLevel;
  location: ResearchConfidenceLevel;
  description: ResearchConfidenceLevel;
  organizer: ResearchConfidenceLevel;
  hero_image: ResearchConfidenceLevel;
};

export type ResearchFestivalResult = {
  query: string;
  normalized_query: string;
  best_guess: ResearchBestGuess;
  candidates: ResearchCandidates;
  sources: ResearchSource[];
  confidence: ResearchConfidence;
  warnings: string[];
  evidence: ResearchEvidence[];
  metadata?: {
    provider: "mock" | "web";
    mode: "generic_mock" | "special_case_mock" | "real_web";
    source_count: number;
  };
  // Legacy mirror fields for compatibility in consumers still expecting flat payloads.
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  city?: string | null;
  location?: string | null;
  description?: string | null;
  organizer?: string | null;
  hero_image?: string | null;
  tags?: string[];
};

export type ResearchFestivalRequest = {
  query: string;
};

export type ResearchFestivalApiResponse = {
  ok: true;
  result: ResearchFestivalResult;
};
