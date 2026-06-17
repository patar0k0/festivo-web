import { z } from "zod";

/** Wraps a value with the model's self-reported confidence + review flag. */
function conf<T extends z.ZodTypeAny>(inner: T) {
  return z.object({
    value: inner,
    confidence: z.number().min(0).max(1).catch(0),
    needs_review: z.boolean().catch(false),
  });
}

const dateComponents = z.object({
  day: z.number().int().min(1).max(31).nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  year: z.number().int().min(2000).max(2100).nullable(),
  year_explicit: z.boolean().catch(false),
  weekday: z.string().nullable().catch(null),
});

const programItem = z.object({
  title: z.string(),
  start_time: z.string().nullable().catch(null), // "HH:mm" or null
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

  start_date: dateComponents,
  end_date: dateComponents,
  // Non-event dates (e.g. "срок за записване"); never used as start/end.
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
