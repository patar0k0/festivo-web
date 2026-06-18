import { z } from "zod";

/**
 * Wraps a value with the model's self-reported confidence + review flag.
 * Uses z.preprocess so that if Gemini returns a plain scalar (e.g. city: "Бутово"
 * instead of {value: "Бутово", confidence: 0.9, needs_review: false}), we wrap it
 * rather than losing the data entirely.
 */
function conf<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess(
    (val) => {
      if (val !== null && val !== undefined && typeof val === "object" && "value" in val) {
        return val; // already the correct {value, confidence, needs_review} shape
      }
      // Plain scalar from Gemini — wrap it so data is not lost
      return { value: val ?? null, confidence: 0.5, needs_review: true };
    },
    z.object({
      value: inner,
      confidence: z.number().min(0).max(1).catch(0.5),
      needs_review: z.boolean().catch(true),
    }),
  );
}

const emptyDate = { day: null, month: null, year: null, year_explicit: false, weekday: null };

function preprocessDate(val: unknown): unknown {
  if (!val) return emptyDate;
  if (typeof val === "object") return val; // already {day, month, year, ...}
  if (typeof val === "string") {
    // ISO date "YYYY-MM-DD"
    const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]), year_explicit: true, weekday: null };
    }
    // Bulgarian "DD.MM.YYYY" or "DD.MM.YY"
    const bg = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (bg) {
      const y = Number(bg[3]);
      return { day: Number(bg[1]), month: Number(bg[2]), year: y < 100 ? 2000 + y : y, year_explicit: true, weekday: null };
    }
  }
  return emptyDate;
}

const dateComponents = z.object({
  day: z.number().int().min(1).max(31).nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  year: z.number().int().min(2000).max(2100).nullable(),
  year_explicit: z.boolean().catch(false),
  weekday: z.string().nullable().catch(null),
});

const preprocessedDate = z.preprocess(preprocessDate, dateComponents.catch(emptyDate));

const programItem = z.object({
  title: z.string(),
  start_time: z.string().nullable().catch(null),
  end_time: z.string().nullable().catch(null),
  stage: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
});

const programDay = z.object({
  day: z.number().int().min(1).max(31).nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  title: z.string().nullable().catch(null),
  items: z.array(programItem).catch([]),
});

export const posterExtractionSchema = z.object({
  title: conf(z.string().nullable()),
  title_candidates: z.array(z.string()).catch([]),
  category: conf(z.string().nullable()),

  start_date: preprocessedDate,
  end_date: preprocessedDate,
  other_dates: z
    .array(z.object({ label: z.string(), day: z.number().int().nullable(), month: z.number().int().nullable(), year: z.number().int().nullable() }))
    .catch([]),

  start_time: conf(z.string().nullable()),
  end_time: conf(z.string().nullable()),

  city: conf(z.string().nullable()),
  venue_name: conf(z.string().nullable()),
  address: conf(z.string().nullable()),

  organizer_name: conf(z.string().nullable()),
  organizer_names: z.array(z.string()).catch([]),

  description: conf(z.string().nullable()),
  is_free: conf(z.boolean().nullable()),
  price_range: conf(z.string().nullable()),

  website_url: conf(z.string().nullable()),
  facebook_url: conf(z.string().nullable()),
  instagram_url: conf(z.string().nullable()),
  ticket_url: conf(z.string().nullable()),

  contact: z.object({ phone: z.string().nullable().catch(null), person: z.string().nullable().catch(null) }).catch({ phone: null, person: null }),

  tags: z.array(z.string()).catch([]),

  program: z.object({ days: z.array(programDay) }).nullable().catch(null),
});

export type PosterExtraction = z.infer<typeof posterExtractionSchema>;
export type PosterDateComponents = z.infer<typeof dateComponents>;
