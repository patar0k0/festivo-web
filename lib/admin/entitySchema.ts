/**
 * Schema-driven admin entity layout: canonical field labels, summary strip contract,
 * section order, and grid span rules for Research / Ingest / Pending / Published festival pages.
 */

import type { ReactNode } from "react";
import type { SuggestionField } from "@/lib/festival/normalizationSuggestions";

/** Compatible with `AdminSummaryStrip` items. */
export type AdminSummaryStripItem = { label: string; value: ReactNode };

/** Canonical UI labels — one string per concept across admin entity pages. */
export const ADMIN_FIELD_LABEL = {
  title: "Title",
  status: "Status",
  category: "Category",
  tags: "Tags",
  startDate: "Start date",
  endDate: "End date",
  startTime: "Start time",
  endTime: "End time",
  city: "City",
  region: "Region",
  locationName: "Location name",
  address: "Address",
  organizerName: "Organizer name",
  sourceUrl: "Source URL",
  websiteUrl: "Website URL",
  facebookUrl: "Facebook URL",
  instagramUrl: "Instagram URL",
  ticketUrl: "Ticket URL",
  sourceType: "Source type",
  heroImage: "Hero image",
  description: "Description",
  shortDescription: "Short description",
  createdAt: "Created at",
  updatedAt: "Updated at",
  reviewedAt: "Reviewed at",
  reviewedBy: "Reviewed by",
  slug: "Slug",
  isFree: "Free entry",
  priceRange: "Price range",
  latitude: "Latitude",
  longitude: "Longitude",
  cityId: "City (ID)",
  cityDisplay: "City (display)",
  occurrenceDays: "Occurrence days",
  /** Secondary / debug: AI or ingest column names */
  titleClean: "Title (extracted)",
  descriptionClean: "Description (extracted)",
  categoryGuess: "Category (guess)",
  tagsGuess: "Tags (guess)",
  cityGuess: "City (guess)",
  locationGuess: "Location name (guess)",
  dateGuess: "Date (guess)",
  normalizationVersion: "Normalization version",
  extractionVersion: "Extraction version",
  heroImageSource: "Hero image source",
  heroImageScore: "Hero image score",
  heroImageOriginalUrl: "Hero image (original URL)",
  sourcePrimaryUrl: "Source primary URL",
  sourceCount: "Source count",
  discoveredVia: "Discovered via",
  verificationStatus: "Verification status",
  verificationScore: "Verification score",
  duplicateOf: "Duplicate of",
  recordId: "Record ID",
  confidence: "Confidence",
  pipeline: "Pipeline",
  sourceLine: "Source / type",
  organizer: "Organizer",
  organizers: "Organizers",
  promotion: "Promotion",
  queue: "Queue",
  review: "Review",
  jobsOnPage: "Jobs (page)",
  promotionStatus: "Promotion status",
  promotionStartedAt: "Promotion started at",
  promotionExpiresAt: "Promotion ends at",
  promotionRank: "Promotion rank",
} as const;

export type AdminFieldLabelKey = keyof typeof ADMIN_FIELD_LABEL;

/** Top summary strip — fixed six cells (labels only). */
export const ADMIN_SUMMARY_STRIP_LABEL = {
  status: ADMIN_FIELD_LABEL.status,
  sourceLine: ADMIN_FIELD_LABEL.sourceLine,
  city: ADMIN_FIELD_LABEL.city,
  startDate: ADMIN_FIELD_LABEL.startDate,
  organizer: ADMIN_FIELD_LABEL.organizer,
} as const;

/**
 * Standard six-cell summary row: status, source/type line, city, start date, organizer, context.
 * `contextLabel` + `contextValue` are page-specific (pipeline, queue, review, updated at, etc.).
 */
export function buildStandardSummaryStripItems(input: {
  status: ReactNode;
  sourceLine: ReactNode;
  city: ReactNode;
  startDate: ReactNode;
  organizer: ReactNode;
  contextLabel: string;
  contextValue: ReactNode;
}): AdminSummaryStripItem[] {
  return [
    { label: ADMIN_SUMMARY_STRIP_LABEL.status, value: input.status },
    { label: ADMIN_SUMMARY_STRIP_LABEL.sourceLine, value: input.sourceLine },
    { label: ADMIN_SUMMARY_STRIP_LABEL.city, value: input.city },
    { label: ADMIN_SUMMARY_STRIP_LABEL.startDate, value: input.startDate },
    { label: ADMIN_SUMMARY_STRIP_LABEL.organizer, value: input.organizer },
    { label: input.contextLabel, value: input.contextValue },
  ];
}

/** Section identifiers shared across entity pages. */
export type AdminEntitySectionId =
  | "researchQueries"
  | "mainInfo"
  | "dateTime"
  | "location"
  | "organizer"
  | "linksSources"
  | "media"
  | "descriptionContent"
  | "systemMeta"
  | "ingestQueue";

/** Section titles + variants — canonical copy (kept in sync with `adminSectionTitles.ts`). */
export const ADMIN_ENTITY_SECTION = {
  researchQueries: { title: "Research queries", variant: "default" as const },
  mainInfo: { title: "Main info", variant: "main" as const },
  dateTime: { title: "Date & time", variant: "date" as const },
  location: { title: "Location", variant: "location" as const },
  organizer: { title: "Organizer", variant: "organizer" as const },
  linksSources: { title: "Links & sources", variant: "links" as const },
  media: { title: "Media", variant: "media" as const },
  descriptionContent: { title: "Description & content", variant: "description" as const },
  systemMeta: { title: "System / moderation / ingestion", variant: "system" as const },
  ingestQueue: { title: "Ingest queue", variant: "system" as const },
};

/** Default order + copy hints per admin surface (documentation + future generators). */
export const ADMIN_ENTITY_PAGE_SECTION_ORDER: Record<
  "research" | "ingest" | "pending" | "festival",
  readonly AdminEntitySectionId[]
> = {
  research: [
    "researchQueries",
    "mainInfo",
    "dateTime",
    "location",
    "organizer",
    "linksSources",
    "media",
    "descriptionContent",
    "systemMeta",
  ],
  ingest: ["linksSources", "systemMeta"],
  pending: [
    "mainInfo",
    "dateTime",
    "location",
    "organizer",
    "linksSources",
    "media",
    "descriptionContent",
  ],
  festival: [
    "mainInfo",
    "dateTime",
    "location",
    "organizer",
    "linksSources",
    "media",
    "descriptionContent",
    "systemMeta",
  ],
};

/** Grid width: short scalars = half; long text, URLs, tags, evidence = full. */
export type AdminEntityFieldSpan = "half" | "full";

const FULL_WIDTH_FIELDS = new Set<string>([
  "title",
  "tags",
  "description",
  "address",
  "sourceUrl",
  "websiteUrl",
  "facebookUrl",
  "instagramUrl",
  "ticketUrl",
  "heroImage",
  "locationName",
  "cityInput",
  "occurrenceDays",
  "sourcePrimaryUrl",
  "discoveredVia",
  "reviewedBy",
]);

export function adminEntityFieldGridClass(field: string): "" | "md:col-span-2" {
  return FULL_WIDTH_FIELDS.has(field) ? "md:col-span-2" : "";
}

/**
 * Canonical `AdminFieldLabel` `field` keys rendered with label + control on one row from `sm` up
 * (see `AdminFieldInlineRow`). Long text, URLs, tags, media, and complex blocks stay stacked.
 */
export const ADMIN_ENTITY_INLINE_LAYOUT_FIELDS = new Set<string>([
  "city",
  "cityId",
  "cityDisplay",
  "status",
  "category",
  "organizerName",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
]);

export function adminEntityUsesInlineLayout(field: string): boolean {
  return ADMIN_ENTITY_INLINE_LAYOUT_FIELDS.has(field);
}

/** Research-with-AI panel: long text + URLs full width; short scalars half. */
export function adminResearchAiFieldGridClass(key: string): "" | "md:col-span-2" {
  const full = new Set([
    "title",
    "address",
    "website_url",
    "facebook_url",
    "instagram_url",
    "ticket_url",
    "hero_image",
  ]);
  return full.has(key) ? "md:col-span-2" : "";
}

const READONLY_ROW_LABEL_OVERRIDES: Record<string, string> = {
  id: "Record ID",
  source_primary_url: ADMIN_FIELD_LABEL.sourcePrimaryUrl,
  source_count: ADMIN_FIELD_LABEL.sourceCount,
  discovered_via: ADMIN_FIELD_LABEL.discoveredVia,
  verification_status: ADMIN_FIELD_LABEL.verificationStatus,
  verification_score: ADMIN_FIELD_LABEL.verificationScore,
  duplicate_of: ADMIN_FIELD_LABEL.duplicateOf,
  created_at: ADMIN_FIELD_LABEL.createdAt,
  updated_at: ADMIN_FIELD_LABEL.updatedAt,
  reviewed_at: ADMIN_FIELD_LABEL.reviewedAt,
  reviewed_by: ADMIN_FIELD_LABEL.reviewedBy,
};

export function getAdminFieldLabel(key: string): string {
  if (key in ADMIN_FIELD_LABEL) {
    return ADMIN_FIELD_LABEL[key as AdminFieldLabelKey];
  }
  if (READONLY_ROW_LABEL_OVERRIDES[key]) {
    return READONLY_ROW_LABEL_OVERRIDES[key];
  }
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const SUGGESTION_FIELD_LABEL: Record<SuggestionField, AdminFieldLabelKey> = {
  category: "category",
  tags: "tags",
  venue_name: "locationName",
  city_id: "city",
  start_date: "startDate",
  end_date: "endDate",
  organizer_name: "organizerName",
  source_url: "sourceUrl",
  website_url: "websiteUrl",
  ticket_url: "ticketUrl",
};

/** Canonical labels for normalization suggestion cards (pending bottom section). */
export function adminLabelForSuggestionField(field: SuggestionField): string {
  return ADMIN_FIELD_LABEL[SUGGESTION_FIELD_LABEL[field]];
}

/** Shared single-line control styles (no width — compose with `w-full`, `flex-1`, etc.). */
export const ADMIN_ENTITY_CONTROL_BASE =
  "h-8 rounded-lg border border-black/[0.1] bg-white px-2.5 text-sm text-black/90 placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/10";

/** Standard full-width text/select/time inputs on admin entity pages. */
export const ADMIN_ENTITY_CONTROL_CLASS = `w-full ${ADMIN_ENTITY_CONTROL_BASE}`;

/** Read-only single-line fields (system / guess columns). */
export const ADMIN_ENTITY_CONTROL_READONLY_CLASS =
  "w-full h-8 rounded-lg border border-black/[0.1] bg-black/[0.03] px-2.5 text-sm text-black/80";

/** Multi-line editable text — full width; min-height preserves readability. */
export const ADMIN_ENTITY_TEXTAREA_CLASS =
  "w-full min-h-[4.5rem] rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm text-black/90 placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/10";

export const ADMIN_ENTITY_TEXTAREA_READONLY_CLASS =
  "w-full min-h-[3.5rem] rounded-lg border border-black/[0.1] bg-black/[0.03] px-2.5 py-1.5 text-sm text-black/80";
