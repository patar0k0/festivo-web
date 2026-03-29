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
  start_date: string | null;
  end_date: string | null;
  source_url: string;
  source_title?: string | null;
  tier: SourceAuthorityTier | null;
  language: ResearchLanguageSignal | null;
  confidence?: ResearchConfidenceLevel | null;
  reason?: string | null;
  label: string | null;
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
  /** Venue / place name (maps from extraction location_name). */
  location: string | null;
  organizer: string | null;
  description: string | null;
  hero_image: string | null;
  tags: string[];
  is_free?: boolean | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  ticket_url?: string | null;
  address?: string | null;
  category?: string | null;
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
  is_free?: ResearchConfidenceLevel;
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
    provider: "mock" | "web" | "openai_web" | "gemini_pipeline";
    mode:
      | "generic_mock"
      | "special_case_mock"
      | "real_web"
      | "openai_structured"
      | "fallback_minimal"
      | "gemini_multi_step";
    source_count: number;
    model?: string;
    openai_attempted?: boolean;
    openai_json_parsed?: boolean;
    fallback_used?: boolean;
  };
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  city?: string | null;
  location?: string | null;
  description?: string | null;
  organizer?: string | null;
  hero_image?: string | null;
  tags?: string[];
  is_free?: boolean | null;
};

export type ResearchFestivalRequest = {
  query: string;
};

export type ResearchFestivalApiResponse = {
  ok: true;
  result: ResearchFestivalResult;
};
