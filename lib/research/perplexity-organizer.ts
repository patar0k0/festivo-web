export type OrganizerResearchConfidence = "low" | "medium" | "high";

export type PerplexityOrganizerResearchResult = {
  name: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
  source_urls: string[];
  confidence: OrganizerResearchConfidence;
  missing_fields: string[];
};

type PerplexityMessage = {
  role: "system" | "user";
  content: string;
};

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar-pro";
const TIMEOUT_MS = 30_000;

const REQUIRED_FIELDS: Array<keyof PerplexityOrganizerResearchResult> = [
  "name",
  "description",
  "logo_url",
  "website_url",
  "facebook_url",
  "instagram_url",
  "email",
  "phone",
  "source_urls",
  "confidence",
  "missing_fields",
];

function sanitizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeConfidence(value: unknown): OrganizerResearchConfidence {
  return value === "high" || value === "medium" ? value : "low";
}

function sanitizeUrl(value: unknown): string | null {
  const candidate = sanitizeNullableString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeEmail(value: unknown): string | null {
  const candidate = sanitizeNullableString(value);
  if (!candidate) return null;
  const normalized = candidate.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function sanitizePhone(value: unknown): string | null {
  const candidate = sanitizeNullableString(value);
  if (!candidate) return null;
  const compact = candidate.replace(/\s+/g, " ").trim();
  return compact.length >= 6 ? compact : null;
}

function normalizeSourceUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    const keys = [...url.searchParams.keys()];
    for (const key of keys) {
      if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "fbclid") {
        url.searchParams.delete(key);
      }
    }
    const pathname = url.pathname.replace(/\/$/, "");
    url.pathname = pathname || "/";
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = normalizeSourceUrl(item);
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return [...deduped];
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const direct = raw.trim();
  try {
    return JSON.parse(direct) as Record<string, unknown>;
  } catch {
    const fenced = direct.match(/```json\s*([\s\S]*?)```/i) ?? direct.match(/```\s*([\s\S]*?)```/i);
    if (!fenced?.[1]) {
      throw new Error("Perplexity organizer response was not valid JSON.");
    }
    return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
  }
}

function buildMissingFields(result: PerplexityOrganizerResearchResult): string[] {
  const missing: string[] = [];
  if (!result.description) missing.push("description");
  if (!result.logo_url) missing.push("logo_url");
  if (!result.website_url) missing.push("website_url");
  if (!result.facebook_url) missing.push("facebook_url");
  if (!result.instagram_url) missing.push("instagram_url");
  if (!result.email) missing.push("email");
  if (!result.phone) missing.push("phone");
  return missing;
}

function normalizeResult(data: Record<string, unknown>): PerplexityOrganizerResearchResult {
  const source_urls = sanitizeStringArray(data.source_urls);
  const result: PerplexityOrganizerResearchResult = {
    name: sanitizeNullableString(data.name),
    description: sanitizeNullableString(data.description),
    logo_url: sanitizeUrl(data.logo_url),
    website_url: sanitizeUrl(data.website_url),
    facebook_url: sanitizeUrl(data.facebook_url),
    instagram_url: sanitizeUrl(data.instagram_url),
    email: sanitizeEmail(data.email),
    phone: sanitizePhone(data.phone),
    source_urls,
    confidence: sanitizeConfidence(data.confidence),
    missing_fields: [],
  };

  if (!result.website_url && source_urls.length > 0) {
    result.website_url = source_urls[0];
  }

  if (!result.facebook_url) {
    const facebookSource = source_urls.find((url) => /(^|\.|\/\/)(www\.)?facebook\.com\//i.test(url));
    if (facebookSource) result.facebook_url = facebookSource;
  }

  if (!result.instagram_url) {
    const instagramSource = source_urls.find((url) => /(^|\.|\/\/)(www\.)?instagram\.com\//i.test(url));
    if (instagramSource) result.instagram_url = instagramSource;
  }

  result.missing_fields = buildMissingFields(result);
  return result;
}

function buildMessages(query: string): PerplexityMessage[] {
  return [
    {
      role: "system",
      content: [
        "You extract organizer profile data from web sources.",
        "Return ONLY valid JSON. Never hallucinate.",
        "If unsure, return null.",
        "Prefer official website and official social pages over third-party listings.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Organizer research query: ${query}`,
        "Return STRICT JSON with this exact schema and no extra keys:",
        JSON.stringify(
          {
            name: null,
            description: null,
            logo_url: null,
            website_url: null,
            facebook_url: null,
            instagram_url: null,
            email: null,
            phone: null,
            source_urls: [],
            confidence: "low",
            missing_fields: [],
          },
          null,
          2,
        ),
        "Rules:",
        "- use only explicitly available information",
        "- description should be short factual summary in Bulgarian when possible",
        "- include source_urls used for extraction",
        "- confidence must be low, medium, or high",
      ].join("\n"),
    },
  ];
}

function assertRequiredFields(result: Record<string, unknown>) {
  const missing = REQUIRED_FIELDS.filter((key) => !(key in result));
  if (missing.length > 0) {
    throw new Error(`Perplexity organizer response missing required keys: ${missing.join(", ")}`);
  }
}

export async function researchOrganizer(query: string): Promise<PerplexityOrganizerResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("query is required");
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          schema: {
            type: "object",
            additionalProperties: false,
            required: REQUIRED_FIELDS,
            properties: {
              name: { type: ["string", "null"] },
              description: { type: ["string", "null"] },
              logo_url: { type: ["string", "null"] },
              website_url: { type: ["string", "null"] },
              facebook_url: { type: ["string", "null"] },
              instagram_url: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              source_urls: { type: "array", items: { type: "string" } },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
              missing_fields: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      messages: buildMessages(normalizedQuery),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const payloadText = await response.text().catch(() => "");
    throw new Error(`Perplexity organizer request failed (${response.status}): ${payloadText || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> }
    | null;

  const content = payload?.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((item) => (item?.type === "text" ? item.text ?? "" : ""))
            .join("\n")
            .trim()
        : "";

  if (!text) {
    throw new Error("Perplexity organizer response did not include content");
  }

  const asJson = parseJsonObject(text);
  assertRequiredFields(asJson);
  return normalizeResult(asJson);
}
