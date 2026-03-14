export type ResearchConfidenceLevel = "high" | "medium" | "low";

export type ResearchSource = {
  url: string;
  domain: string;
  title: string;
  is_official: boolean;
};

export type ResearchEvidence = {
  field: string;
  value: string;
  source_url: string;
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
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  location: string | null;
  description: string | null;
  organizer: string | null;
  hero_image: string | null;
  tags: string[];
  sources: ResearchSource[];
  confidence: ResearchConfidence;
  warnings: string[];
  evidence: ResearchEvidence[];
  metadata?: {
    provider: "mock" | "web";
    mode: "generic_mock" | "special_case_mock" | "real_web";
    source_count: number;
  };
};

export type ResearchFestivalRequest = {
  query: string;
};

export type ResearchFestivalApiResponse = {
  ok: true;
  result: ResearchFestivalResult;
};
