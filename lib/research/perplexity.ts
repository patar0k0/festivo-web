export type AiResearchConfidence = "low" | "medium" | "high";

export type PerplexityFestivalResearchResult = {
  title: string | null;
  description: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  ticket_url: string | null;
  hero_image: string | null;
  is_free: boolean | null;
  source_urls: string[];
  confidence: AiResearchConfidence;
  missing_fields: string[];
};

type PerplexityMessage = {
  role: "system" | "user";
  content: string;
};

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar";
const TIMEOUT_MS = 30_000;

const REQUIRED_SCHEMA_FIELDS: Array<keyof PerplexityFestivalResearchResult> = [
  "title",
  "description",
  "category",
  "start_date",
  "end_date",
  "city",
  "location_name",
  "address",
  "organizer_name",
  "website_url",
  "facebook_url",
  "instagram_url",
  "ticket_url",
  "hero_image",
  "is_free",
  "source_urls",
  "confidence",
  "missing_fields",
];

function sanitizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeBooleanOrNull(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

function sanitizeConfidence(value: unknown): AiResearchConfidence {
  return value === "high" || value === "medium" ? value : "low";
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitizeNullableString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const direct = raw.trim();
  try {
    return JSON.parse(direct) as Record<string, unknown>;
  } catch {
    const fenced = direct.match(/```json\s*([\s\S]*?)```/i) ?? direct.match(/```\s*([\s\S]*?)```/i);
    if (!fenced?.[1]) {
      throw new Error("Perplexity response was not valid JSON.");
    }
    return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
  }
}

function normalizeResult(data: Record<string, unknown>): PerplexityFestivalResearchResult {
  return {
    title: sanitizeNullableString(data.title),
    description: sanitizeNullableString(data.description),
    category: sanitizeNullableString(data.category),
    start_date: sanitizeNullableString(data.start_date),
    end_date: sanitizeNullableString(data.end_date),
    city: sanitizeNullableString(data.city),
    location_name: sanitizeNullableString(data.location_name),
    address: sanitizeNullableString(data.address),
    organizer_name: sanitizeNullableString(data.organizer_name),
    website_url: sanitizeNullableString(data.website_url),
    facebook_url: sanitizeNullableString(data.facebook_url),
    instagram_url: sanitizeNullableString(data.instagram_url),
    ticket_url: sanitizeNullableString(data.ticket_url),
    hero_image: sanitizeNullableString(data.hero_image),
    is_free: sanitizeBooleanOrNull(data.is_free),
    source_urls: sanitizeStringArray(data.source_urls),
    confidence: sanitizeConfidence(data.confidence),
    missing_fields: sanitizeStringArray(data.missing_fields),
  };
}

function buildMessages(query: string): PerplexityMessage[] {
  return [
    {
      role: "system",
      content:
        "You extract festival facts from web sources. Return ONLY valid JSON. Unknown values must be null. Never hallucinate. Always include source_urls with the URLs you relied on.",
    },
    {
      role: "user",
      content: [
        `Research query: ${query}`,
        "Return STRICT JSON with this exact schema and no extra keys:",
        JSON.stringify(
          {
            title: null,
            description: null,
            category: null,
            start_date: null,
            end_date: null,
            city: null,
            location_name: null,
            address: null,
            organizer_name: null,
            website_url: null,
            facebook_url: null,
            instagram_url: null,
            ticket_url: null,
            hero_image: null,
            is_free: null,
            source_urls: [],
            confidence: "low",
            missing_fields: [],
          },
          null,
          2,
        ),
        "Rules:",
        "- unknown = null",
        "- do not infer missing facts",
        "- confidence must be one of: low, medium, high",
        "- source_urls must contain at least one source URL if any factual claim is present",
        "- missing_fields must list schema keys that are still null or unknown",
      ].join("\n"),
    },
  ];
}

function assertRequiredKeys(result: Record<string, unknown>) {
  const missing = REQUIRED_SCHEMA_FIELDS.filter((key) => !(key in result));
  if (missing.length > 0) {
    throw new Error(`Perplexity response missing required keys: ${missing.join(", ")}`);
  }
}

export async function researchFestival(query: string): Promise<PerplexityFestivalResearchResult> {
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
            required: REQUIRED_SCHEMA_FIELDS,
            properties: {
              title: { type: ["string", "null"] },
              description: { type: ["string", "null"] },
              category: { type: ["string", "null"] },
              start_date: { type: ["string", "null"] },
              end_date: { type: ["string", "null"] },
              city: { type: ["string", "null"] },
              location_name: { type: ["string", "null"] },
              address: { type: ["string", "null"] },
              organizer_name: { type: ["string", "null"] },
              website_url: { type: ["string", "null"] },
              facebook_url: { type: ["string", "null"] },
              instagram_url: { type: ["string", "null"] },
              ticket_url: { type: ["string", "null"] },
              hero_image: { type: ["string", "null"] },
              is_free: { type: ["boolean", "null"] },
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
    throw new Error(`Perplexity request failed (${response.status}): ${payloadText || response.statusText}`);
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
    throw new Error("Perplexity response did not include content");
  }

  const asJson = parseJsonObject(text);
  assertRequiredKeys(asJson);

  return normalizeResult(asJson);
}
