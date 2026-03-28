export type SuggestionField =
  | "category"
  | "tags"
  | "venue_name"
  | "city_id"
  | "start_date"
  | "end_date"
  | "organizer_name"
  | "source_url"
  | "website_url"
  | "ticket_url";

export type FieldSuggestion = {
  field: SuggestionField;
  value: string | string[];
  confidence: number | null;
  warning: string | null;
  reason: string | null;
  source: "merge" | "ai" | "deterministic";
};

type AnyObject = Record<string, unknown>;

const FIELD_ALIASES: Record<SuggestionField, string[]> = {
  category: ["category"],
  tags: ["tags"],
  venue_name: ["venue_name", "location_name", "venue"],
  city_id: ["city_id", "city", "city_name_display"],
  start_date: ["start_date"],
  end_date: ["end_date"],
  organizer_name: ["organizer_name"],
  source_url: ["source_url"],
  website_url: ["website_url"],
  ticket_url: ["ticket_url"],
};

function asObject(value: unknown): AnyObject | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as AnyObject) : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as AnyObject) : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asTags(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const tags = value.map((item) => asString(item)).filter((tag): tag is string => Boolean(tag));
    return tags.length > 0 ? tags : null;
  }
  const text = asString(value);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      const tags = parsed.map((item) => asString(item)).filter((tag): tag is string => Boolean(tag));
      return tags.length > 0 ? tags : null;
    }
  } catch {
    // plain csv
  }
  const tags = text.split(",").map((item) => item.trim()).filter(Boolean);
  return tags.length > 0 ? tags : null;
}

function pickNormalizedValue(field: SuggestionField, raw: unknown): string | string[] | null {
  if (field === "tags") return asTags(raw);
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return asString(raw);
}

function pickEntry(obj: AnyObject, field: SuggestionField): unknown {
  const aliases = FIELD_ALIASES[field];
  for (const key of aliases) {
    if (key in obj) return obj[key];
  }

  const fields = asObject(obj.fields);
  if (fields) {
    for (const key of aliases) {
      if (key in fields) return fields[key];
    }
  }

  const suggestions = asObject(obj.suggestions);
  if (suggestions) {
    for (const key of aliases) {
      if (key in suggestions) return suggestions[key];
    }
  }

  return null;
}

function extractSuggestion(field: SuggestionField, payload: AnyObject, source: FieldSuggestion["source"]): FieldSuggestion | null {
  const entry = pickEntry(payload, field);
  if (entry === null || entry === undefined) return null;

  if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
    const obj = entry as AnyObject;
    const value = pickNormalizedValue(field, obj.value ?? obj.final_value ?? obj.suggested ?? obj.suggestion ?? obj.selected_value ?? obj.output ?? obj);
    if (value === null) return null;

    const confidenceRaw = obj.confidence;
    const confidence = typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw) ? confidenceRaw : null;

    return {
      field,
      value,
      confidence,
      warning: asString(obj.warning),
      reason: asString(obj.reason),
      source,
    };
  }

  const value = pickNormalizedValue(field, entry);
  if (value === null) return null;

  return { field, value, confidence: null, warning: null, reason: null, source };
}

export function extractNormalizationSuggestions(params: {
  deterministic_guess_json: unknown;
  ai_guess_json: unknown;
  merge_decisions_json: unknown;
}): FieldSuggestion[] {
  const deterministic = asObject(params.deterministic_guess_json);
  const ai = asObject(params.ai_guess_json);
  const merge = asObject(params.merge_decisions_json);

  const fields = Object.keys(FIELD_ALIASES) as SuggestionField[];
  return fields
    .map((field) => {
      return (
        (merge ? extractSuggestion(field, merge, "merge") : null) ??
        (ai ? extractSuggestion(field, ai, "ai") : null) ??
        (deterministic ? extractSuggestion(field, deterministic, "deterministic") : null)
      );
    })
    .filter((entry): entry is FieldSuggestion => Boolean(entry));
}
