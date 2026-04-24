"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { transliteratedSlug } from "@/lib/text/slug";
import type { OrganizerProfile } from "@/lib/types";
import { pendingRowToOrganizerEntries } from "@/lib/admin/pendingOrganizerEntries";
import TagsInput from "@/components/admin/TagsInput";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import OccurrenceDaysEditor from "@/components/admin/OccurrenceDaysEditor";
import { mergeOccurrenceDatesWithRange, normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { extractNormalizationSuggestions, type SuggestionField } from "@/lib/festival/normalizationSuggestions";
import { listFilledPendingRecordFields, type PendingFestivalQuality } from "@/lib/admin/pendingFestivalQuality";
import { resolvePendingDraftEditorOpenAction } from "@/lib/festival/editorOpenAction";
import FestivalEditorOpenSecondary from "@/components/festival/FestivalEditorOpenSecondary";
import { dbTimeToHmInput } from "@/lib/festival/festivalTimeFields";
import { getVideoEmbedSrcFromPageUrl, isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";
import {
  MEDIA_LIMITS,
  mediaPlanDisplayLabel,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";
import AdminFestivalDescriptionFields from "@/components/admin/AdminFestivalDescriptionFields";
import {
  AdminFieldGrid,
  AdminFieldInlineRow,
  AdminFieldLabel,
  AdminFieldSection,
  AdminSummaryStrip,
  ADMIN_ENTITY_SECTION,
  ADMIN_ENTITY_CONTROL_BASE,
  ADMIN_ENTITY_CONTROL_CLASS,
  ADMIN_ENTITY_CONTROL_READONLY_CLASS,
  ADMIN_ENTITY_TEXTAREA_READONLY_CLASS,
  buildStandardSummaryStripItems,
} from "@/components/admin/entity";
import { ADMIN_FIELD_LABEL, adminLabelForSuggestionField, getAdminFieldLabel } from "@/lib/admin/entitySchema";
import { getAIProviderLabel, getPendingResearchProviderKey } from "@/lib/ai/providerUi";
import AdminMonetizationSummaryCard from "@/components/admin/AdminMonetizationSummaryCard";
import { festivalSettlementSourceText } from "@/lib/settlements/festivalCityText";
import ProgramDraftEditor from "@/components/admin/ProgramDraftEditor";
import AdminTimeInput from "@/components/admin/inputs/AdminTimeInput";
import { compactProgramDraft, emptyProgramDraft, parseProgramDraftUnknown, programDraftHasContent, type ProgramDraft } from "@/lib/festival/programDraft";
import { decodePlusCode } from "@/lib/location/decodePlusCode";
import { parseGoogleMapsUrl } from "@/lib/location/parseGoogleMapsUrl";
import { toast } from "sonner";

export type PendingFestivalRecord = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  city_id: number | null;
  location_name: string | null;
  address: string | null;
  website_url: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  category?: string | null;
  source_type?: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  occurrence_dates?: unknown;
  organizer_name: string | null;
  organizer_entries?: unknown;
  submission_source?: string | null;
  submitted_by_user_id?: string | null;
  organizer_id?: string | null;
  source_url: string | null;
  is_free: boolean | null;
  promotion_status?: "normal" | "promoted" | null;
  promotion_started_at?: string | null;
  promotion_expires_at?: string | null;
  promotion_rank?: number | null;
  hero_image: string | null;
  hero_image_source?: string | null;
  hero_image_original_url?: string | null;
  hero_image_score?: number | string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  title_clean: string | null;
  description_clean: string | null;
  description_short: string | null;
  category_guess: string | null;
  tags_guess: unknown;
  tags?: unknown;
  city_guess: string | null;
  city_name_display?: string | null;
  city?: {
    id: number;
    name_bg: string | null;
    slug: string | null;
  } | null;
  location_guess: string | null;
  date_guess: string | null;
  is_free_guess: boolean | null;
  normalization_version?: string | null;
  deterministic_guess_json?: unknown;
  ai_guess_json?: unknown;
  merge_decisions_json?: unknown;
  latitude_guess?: number | string | null;
  longitude_guess?: number | string | null;
  lat_guess?: number | string | null;
  lng_guess?: number | string | null;
  video_url?: string | null;
  gallery_image_urls?: unknown;
  program_draft?: unknown;
  [key: string]: unknown;
};

function programDraftStateFromPending(value: unknown): ProgramDraft {
  const p = parseProgramDraftUnknown(value);
  if (p.ok && programDraftHasContent(p.value)) return compactProgramDraft(p.value);
  return emptyProgramDraft();
}

function parseGalleryUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

type ErrorPayload = {
  error?: string;
  normalized_input?: string;
};

type DecisionResponse = {
  ok?: boolean;
  festival_id?: string;
  redirect_to?: string;
  error?: string;
};

type HeroImageUploadResponse = {
  ok?: boolean;
  hero_image?: string | null;
  hero_image_source?: string | null;
  error?: string;
};

type SuggestionComparisonStatus = "empty" | "missing" | "matches" | "different";

function asDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function normalizeAiDateGuess(value: string | null) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function normalizeDisplayValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? normalizeDisplayValue(value) : null;
}

type OrganizerOption = Pick<OrganizerProfile, "id" | "name" | "slug" | "plan" | "plan_started_at" | "plan_expires_at">;

function buildInitialOrganizerEntries(p: PendingFestivalRecord): Array<{ organizer_id: string; name: string }> {
  const rows = pendingRowToOrganizerEntries({
    organizer_entries: p.organizer_entries,
    organizer_id: p.organizer_id ?? null,
    organizer_name: p.organizer_name ?? null,
  });
  return rows.map((r) => ({ organizer_id: r.organizer_id ?? "", name: r.name }));
}

function normalizeOptionalScore(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return trimmed;
  }

  return null;
}

function normalizeTagsGuess(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  const raw = value.trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // Fall back to plain string split for non-JSON values.
  }

  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getComparisonStatus(current: string | null, aiGuess: string | null): SuggestionComparisonStatus {
  if (!aiGuess) {
    return "empty";
  }

  if (!current) {
    return "missing";
  }

  if (current.toLocaleLowerCase("bg-BG") === aiGuess.toLocaleLowerCase("bg-BG")) {
    return "matches";
  }

  return "different";
}

function statusBadgeLabel(status: SuggestionComparisonStatus) {
  if (status === "matches") {
    return "Matches current";
  }

  if (status === "missing") {
    return "Current missing";
  }

  if (status === "different") {
    return "Different";
  }

  if (status === "empty") {
    return "Suggestion missing";
  }

  return null;
}

function formatNormalizationSourceLabel(source: "merge" | "ai" | "deterministic", aiProviderLabel: string) {
  if (source === "ai") return aiProviderLabel;
  if (source === "merge") return "Merge";
  return "Deterministic";
}

function suggestionApplyButtonLabel(
  isApplied: boolean,
  source: "merge" | "ai" | "deterministic",
  aiProviderLabel: string,
): string {
  if (isApplied) return "Applied";
  if (source === "ai") return `Apply (${aiProviderLabel})`;
  return "Apply";
}

function suggestionStateLabel(status: SuggestionComparisonStatus, applied: boolean) {
  if (applied) return "Already applied";
  if (status === "matches") return "Unchanged";
  if (status === "different" || status === "missing") return "Changed";
  return "Not applicable";
}

function validateCoords(latitudeRaw: string, longitudeRaw: string) {
  if (!latitudeRaw && !longitudeRaw) {
    return { valid: true, message: "" };
  }

  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { valid: false, message: "Latitude and longitude must be numbers." };
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { valid: false, message: "Coordinates are out of valid range." };
  }

  return { valid: true, message: "" };
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
  return payload?.error ?? fallback;
}



function qualityBucketTone(bucket: PendingFestivalQuality["quality_bucket"]) {
  if (bucket === "ready") return "border-[#18a05e]/30 bg-[#18a05e]/10 text-[#0e7a45]";
  if (bucket === "needs_fix") return "border-[#b8891e]/30 bg-[#fff7e6] text-[#8a6516]";
  return "border-[#b13a1a]/30 bg-[#fff1ec] text-[#9f3115]";
}

function qualityBucketLabel(bucket: PendingFestivalQuality["quality_bucket"]) {
  if (bucket === "ready") return "Ready";
  if (bucket === "needs_fix") return "Needs fix";
  return "Weak";
}

function asInputValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" ? value : "";
}

function prettyJson(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "—";
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export type LastIngestJobMeta = {
  status: string;
  fb_browser_context: "authenticated" | "anonymous" | null;
  finished_at: string | null;
};

function formatLastIngestLine(meta: LastIngestJobMeta | null): string | null {
  if (!meta) return null;
  const fb =
    meta.fb_browser_context === "authenticated"
      ? "С FB сесия"
      : meta.fb_browser_context === "anonymous"
        ? "Анонимен браузър"
        : "FB режим: неизвестен (преди запис в опашката)";
  const st = meta.status;
  const fin = meta.finished_at ? new Date(meta.finished_at).toLocaleString("bg-BG") : null;
  return [fb, `статус: ${st}`, fin ? `приключи: ${fin}` : null].filter(Boolean).join(" · ");
}

export default function PendingFestivalEditForm({
  pendingFestival,
  qualityDiagnostics,
  lastIngestJobMeta = null,
  organizers = [],
}: {
  pendingFestival: PendingFestivalRecord;
  qualityDiagnostics: PendingFestivalQuality;
  lastIngestJobMeta?: LastIngestJobMeta | null;
  organizers?: OrganizerOption[];
}) {
  const router = useRouter();
  const tagsCurrent = normalizeTagsGuess(pendingFestival.tags);
  const cityDisplayValue =
    festivalSettlementSourceText({
      cityRelation: pendingFestival.city
        ? { name_bg: pendingFestival.city.name_bg, slug: pendingFestival.city.slug }
        : null,
      city_name_display: typeof pendingFestival.city_name_display === "string" ? pendingFestival.city_name_display : null,
      city_guess: typeof pendingFestival.city_guess === "string" ? pendingFestival.city_guess : null,
    }) ?? "";

  const [organizerEntries, setOrganizerEntries] = useState(() => buildInitialOrganizerEntries(pendingFestival));
  const [organizerOptions, setOrganizerOptions] = useState<OrganizerOption[]>(organizers);
  const [organizerSearch, setOrganizerSearch] = useState("");
  const [pendingOrganizerPickId, setPendingOrganizerPickId] = useState("");
  const [manualOrganizerName, setManualOrganizerName] = useState("");
  const [creatingOrganizer, setCreatingOrganizer] = useState(false);
  const [newOrganizerName, setNewOrganizerName] = useState("");

  useEffect(() => {
    setOrganizerEntries(buildInitialOrganizerEntries(pendingFestival));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset organizer rows when pending id changes; full object would over-sync
  }, [pendingFestival.id]);

  useEffect(() => {
    setOrganizerOptions(organizers);
  }, [organizers]);

  const [form, setForm] = useState({
    title: pendingFestival.title,
    slug: pendingFestival.slug ?? "",
    description: pendingFestival.description ?? "",
    description_clean: pendingFestival.description_clean ?? "",
    description_short: asInputValue(pendingFestival.description_short),
    category: (typeof pendingFestival.category === "string" ? pendingFestival.category : "") ?? "",
    category_guess: asInputValue(pendingFestival.category_guess),
    city_id: cityDisplayValue,
    city_guess: asInputValue(pendingFestival.city_guess),
    city_name_display: asInputValue(pendingFestival.city_name_display),
    location_name: pendingFestival.location_name ?? "",
    location_guess: asInputValue(pendingFestival.location_guess),
    venue_name: pendingFestival.location_name ?? "",
    address: pendingFestival.address ?? "",
    address_guess: asInputValue(pendingFestival.address_guess),
    latitude: pendingFestival.latitude?.toString() ?? "",
    longitude: pendingFestival.longitude?.toString() ?? "",
    latitude_guess: asInputValue(pendingFestival.latitude_guess),
    longitude_guess: asInputValue(pendingFestival.longitude_guess),
    lat_guess: asInputValue(pendingFestival.lat_guess),
    lng_guess: asInputValue(pendingFestival.lng_guess),
    start_date: asDateInput(pendingFestival.start_date),
    end_date: asDateInput(pendingFestival.end_date),
    start_time: dbTimeToHmInput(typeof pendingFestival.start_time === "string" ? pendingFestival.start_time : null),
    end_time: dbTimeToHmInput(typeof pendingFestival.end_time === "string" ? pendingFestival.end_time : null),
    date_guess: asInputValue(pendingFestival.date_guess),
    organizer_name: pendingFestival.organizer_name ?? "",
    source_url: pendingFestival.source_url ?? "",
    source_primary_url: asInputValue(pendingFestival.source_primary_url),
    website_url: pendingFestival.website_url ?? "",
    ticket_url: (typeof pendingFestival.ticket_url === "string" ? pendingFestival.ticket_url : "") ?? "",
    source_type: asInputValue(pendingFestival.source_type),
    source_count: asInputValue(pendingFestival.source_count),
    discovered_via: asInputValue(pendingFestival.discovered_via),
    price_range: (typeof pendingFestival.price_range === "string" ? pendingFestival.price_range : "") ?? "",
    is_free: pendingFestival.is_free ?? true,
    is_free_guess: Boolean(pendingFestival.is_free_guess),
    hero_image: pendingFestival.hero_image ?? "",
    hero_image_source: asInputValue(pendingFestival.hero_image_source),
    hero_image_original_url: asInputValue(pendingFestival.hero_image_original_url),
    hero_image_score: asInputValue(pendingFestival.hero_image_score),
    title_clean: asInputValue(pendingFestival.title_clean),
    title_guess: asInputValue(pendingFestival.title_guess),
    normalization_version: asInputValue(pendingFestival.normalization_version),
    verification_status: asInputValue(pendingFestival.verification_status),
    verification_score: asInputValue(pendingFestival.verification_score),
    extraction_version: asInputValue(pendingFestival.extraction_version),
    status: asInputValue(pendingFestival.status),
    duplicate_of: asInputValue(pendingFestival.duplicate_of),
    reviewed_at: asInputValue(pendingFestival.reviewed_at),
    reviewed_by: asInputValue(pendingFestival.reviewed_by),
    created_at: asInputValue(pendingFestival.created_at),
    tags: tagsCurrent,
    tags_guess: normalizeTagsGuess(pendingFestival.tags_guess),
  });
  const [saving, setSaving] = useState(false);
  const [findingCoords, setFindingCoords] = useState(false);
  const [mapsUrlInput, setMapsUrlInput] = useState("");
  const [plusCodeInput, setPlusCodeInput] = useState("");
  const [runningAction, setRunningAction] = useState<"approve" | "reject" | null>(null);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [importingHeroFromUrl, setImportingHeroFromUrl] = useState(false);
  const [removingHeroImage, setRemovingHeroImage] = useState(false);
  const [heroImageSourceState, setHeroImageSourceState] = useState<string | null>(normalizeOptionalText(pendingFestival.hero_image_source));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryExtraInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>(() => parseGalleryUrls(pendingFestival.gallery_image_urls));
  const [videoUrlExtra, setVideoUrlExtra] = useState(() => pendingFestival.video_url?.trim() ?? "");

  const firstResolvedOrganizerId = organizerEntries.find((e) => e.organizer_id && e.organizer_id.trim().length > 0)?.organizer_id.trim() ?? "";
  const firstResolvedOrganizer = useMemo(() => {
    if (!firstResolvedOrganizerId) return null;
    return organizerOptions.find((o) => o.id === firstResolvedOrganizerId) ?? null;
  }, [firstResolvedOrganizerId, organizerOptions]);

  const organizerConfirmedForPlan = Boolean(firstResolvedOrganizerId);

  const mediaPlan = useMemo(() => resolveMediaPlanFromOrganizer(firstResolvedOrganizer), [firstResolvedOrganizer]);
  const mediaLimits = useMemo(() => resolveAllowedMediaLimitsFromOrganizerPlan(firstResolvedOrganizer), [firstResolvedOrganizer]);
  const planLabel = mediaPlanDisplayLabel(mediaPlan);
  const galleryImageCount = galleryUrls.length;
  const heroHasImage = Boolean(form.hero_image.trim());
  const heroAlreadyInGallery = heroHasImage &&
    galleryUrls.some((u) => u.trim() === form.hero_image.trim());
  const totalGallerySlotsUsed =
    galleryImageCount + (heroHasImage && !heroAlreadyInGallery ? 1 : 0);
  const galleryAtLimit = totalGallerySlotsUsed >= mediaLimits.gallery;
  const videoCount = videoUrlExtra.trim().length ? 1 : 0;
  const videoEmbedSrc = useMemo(() => getVideoEmbedSrcFromPageUrl(videoUrlExtra.trim()), [videoUrlExtra]);

  const [extraGalleryBusy, setExtraGalleryBusy] = useState(false);
  const [galleryImportUrl, setGalleryImportUrl] = useState("");
  const [importingGalleryFromUrl, setImportingGalleryFromUrl] = useState(false);
  const galleryOpsBusy = extraGalleryBusy || importingGalleryFromUrl;
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(() => programDraftStateFromPending(pendingFestival.program_draft));
  const [extraVideoBusy, setExtraVideoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [safeApplySummary, setSafeApplySummary] = useState<{ appliedFields: string[]; skippedUnchangedOrMissing: string[] } | null>(null);
  const lastIngestSummary = formatLastIngestLine(lastIngestJobMeta);

  const filledFieldSummaries = useMemo(() => listFilledPendingRecordFields(pendingFestival), [pendingFestival]);

  const editorOpenAction = useMemo(
    () => resolvePendingDraftEditorOpenAction({ slug: form.slug, source_url: form.source_url }),
    [form.slug, form.source_url],
  );

  const [occurrenceDays, setOccurrenceDays] = useState<string[]>(() => normalizeOccurrenceDatesInput(pendingFestival.occurrence_dates) ?? []);
  const [heroPreviewError, setHeroPreviewError] = useState(false);

  useEffect(() => {
    setGalleryUrls(parseGalleryUrls(pendingFestival.gallery_image_urls));
    setVideoUrlExtra(pendingFestival.video_url?.trim() ?? "");
    setProgramDraft(programDraftStateFromPending(pendingFestival.program_draft));
  }, [pendingFestival.id, pendingFestival.gallery_image_urls, pendingFestival.video_url, pendingFestival.program_draft]);
  const [appliedAiFields, setAppliedAiFields] = useState<Record<SuggestionField, boolean>>({
    category: false,
    tags: false,
    venue_name: false,
    city_id: false,
    start_date: false,
    end_date: false,
    organizer_name: false,
    source_url: false,
    website_url: false,
    ticket_url: false,
  });

  const selectedOrganizerIds = useMemo(() => organizerEntries.map((e) => e.organizer_id.trim()).filter(Boolean), [organizerEntries]);

  const availableOrganizerOptions = useMemo(() => {
    const selected = new Set(selectedOrganizerIds);
    const q = organizerSearch.trim().toLowerCase();
    return organizerOptions.filter((item) => {
      if (selected.has(item.id)) return false;
      if (!q) return true;
      return `${item.name} ${item.slug ?? ""}`.toLowerCase().includes(q);
    });
  }, [organizerOptions, organizerSearch, selectedOrganizerIds]);

  const orgLabel = organizerEntries.length <= 1 ? "Организатор" : "Организатори";

  const addOrganizerById = (id: string) => {
    const row = organizerOptions.find((o) => o.id === id);
    if (!row) return;
    setOrganizerEntries((prev) => [...prev, { organizer_id: row.id, name: row.name }]);
    setPendingOrganizerPickId("");
    setOrganizerSearch("");
  };

  const removeOrganizerAt = (index: number) => {
    setOrganizerEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOrganizerNameAt = (index: number, name: string) => {
    setOrganizerEntries((prev) => prev.map((e, i) => (i === index ? { ...e, name } : e)));
  };

  const addManualOrganizer = () => {
    const t = manualOrganizerName.trim();
    if (!t) return;
    setOrganizerEntries((prev) => [...prev, { organizer_id: "", name: t }]);
    setManualOrganizerName("");
  };

  const onCreateOrganizerInline = async () => {
    const name = newOrganizerName.trim();
    if (!name || creatingOrganizer) return;
    setCreatingOrganizer(true);
    setError("");
    try {
      const slug = transliteratedSlug(name);
      const response = await fetch("/admin/api/organizers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || undefined }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно създаване на организатор."));
      }
      const payload = (await response.json().catch(() => null)) as { row?: OrganizerOption } | null;
      const created = payload?.row;
      if (created?.id) {
        setOrganizerOptions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "bg")));
        setOrganizerEntries((prev) => [...prev, { organizer_id: created.id, name: created.name }]);
        setNewOrganizerName("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при създаване на организатор.");
    } finally {
      setCreatingOrganizer(false);
    }
  };

  const normalizationSuggestions = extractNormalizationSuggestions({
    deterministic_guess_json: pendingFestival.deterministic_guess_json,
    ai_guess_json: pendingFestival.ai_guess_json,
    merge_decisions_json: pendingFestival.merge_decisions_json,
  });
  const hasNormalizeSuggestions = normalizationSuggestions.length > 0;
  const hasNormalizationData = Boolean(
    pendingFestival.normalization_version ?? pendingFestival.deterministic_guess_json ?? pendingFestival.ai_guess_json ?? pendingFestival.merge_decisions_json
  );

  const getCurrentValue = (field: SuggestionField) => {
    if (field === "tags") {
      return form.tags.length > 0 ? form.tags.join(", ") : null;
    }

    const current = form[field];
    if (typeof current !== "string") {
      return null;
    }

    return normalizeDisplayValue(current);
  };

  const heroImageUrl = form.hero_image.trim();
  const heroImageSource = heroImageSourceState;
  const heroImageOriginalUrl = normalizeOptionalText(form.hero_image_original_url);
  const ingestOriginalHeroUrl = form.hero_image_original_url.trim();
  const canImportFromIngestOriginal = /^https?:\/\//i.test(ingestOriginalHeroUrl);
  const heroImageScore = normalizeOptionalScore(pendingFestival.hero_image_score);
  const hasHeroImageDiagnostics = heroImageSource !== null || heroImageScore !== null || heroImageOriginalUrl !== null;
  const heroImageStatus = !heroImageUrl
    ? "No hero image selected by ingestion"
    : hasHeroImageDiagnostics
      ? "Hero image selected"
      : "Hero image present, diagnostics unavailable";
  const safeFields: SuggestionField[] = ["category", "tags", "venue_name"];

  const pendingResearchProviderKey = useMemo(() => {
    const extractionVersion =
      typeof pendingFestival.extraction_version === "string" ? pendingFestival.extraction_version : null;
    return getPendingResearchProviderKey(pendingFestival.evidence_json, extractionVersion);
  }, [pendingFestival.evidence_json, pendingFestival.extraction_version]);
  const pendingResearchProviderLabel = useMemo(
    () => getAIProviderLabel(pendingResearchProviderKey),
    [pendingResearchProviderKey],
  );

  const safeSuggestionsTouchAi = useMemo(() => {
    const fields: SuggestionField[] = ["category", "tags", "venue_name"];
    return fields.some((field) => normalizationSuggestions.find((entry) => entry.field === field)?.source === "ai");
  }, [normalizationSuggestions]);

  const guessedPairs = [
    { label: "Date guess", value: qualityDiagnostics.guessed_values.date ?? null },
    { label: "City guess", value: qualityDiagnostics.guessed_values.city ?? null },
    { label: "Location guess", value: qualityDiagnostics.guessed_values.location ?? null },
  ];

  const suggestionRows = normalizationSuggestions.map((suggestion) => {
    const currentValue = getCurrentValue(suggestion.field);
    const suggestedValue = Array.isArray(suggestion.value) ? suggestion.value.join(", ") : suggestion.value;
    const comparisonStatus: SuggestionComparisonStatus = getComparisonStatus(currentValue, normalizeDisplayValue(suggestedValue));
    const isApplied = appliedAiFields[suggestion.field];
    const canApply = !isApplied && comparisonStatus !== "matches" && comparisonStatus !== "empty";
    return {
      suggestion,
      currentValue,
      suggestedValue,
      comparisonStatus,
      isApplied,
      canApply,
    };
  });

  const applicableSuggestionCount = suggestionRows.filter((row) => row.canApply).length;
  const safeSuggestionCount = suggestionRows.filter((row) => safeFields.includes(row.suggestion.field) && row.canApply).length;

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    if (key === "hero_image") {
      setHeroPreviewError(false);
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applySuggestion = (field: SuggestionField, value: string | string[]) => {
    let applied = false;

    if (field === "tags") {
      if (Array.isArray(value)) {
        updateField("tags", value);
        applied = true;
      }
    } else if (typeof value === "string") {
      const normalizedValue = field === "start_date" || field === "end_date" ? normalizeAiDateGuess(value) : value;
      if (normalizedValue) {
        updateField(field, normalizedValue);
        applied = true;
      }
    }

    if (applied) {
      setAppliedAiFields((prev) => ({ ...prev, [field]: true }));
    }

    return applied;
  };

  const applySafeSuggestions = () => {
    const appliedFields: string[] = [];
    const skippedUnchangedOrMissing: string[] = [];

    for (const field of safeFields) {
      const suggestion = normalizationSuggestions.find((entry) => entry.field === field);
      if (!suggestion) {
        skippedUnchangedOrMissing.push(adminLabelForSuggestionField(field));
        continue;
      }

      const currentValue = getCurrentValue(field);
      const suggestionValue = Array.isArray(suggestion.value) ? suggestion.value.join(", ") : suggestion.value;
      const normalizedSuggested = normalizeDisplayValue(suggestionValue);
      const comparisonStatus: SuggestionComparisonStatus = getComparisonStatus(currentValue, normalizedSuggested);
      const canApply = comparisonStatus !== "matches" && comparisonStatus !== "empty";

      if (!canApply) {
        skippedUnchangedOrMissing.push(adminLabelForSuggestionField(field));
        continue;
      }

      const didApply = applySuggestion(field, suggestion.value);
      if (didApply) {
        appliedFields.push(adminLabelForSuggestionField(field));
      }
    }

    setSafeApplySummary({ appliedFields, skippedUnchangedOrMissing });
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || runningAction) return;

    setSaving(true);
    setMessage("");
    setError("");

    const coordsValidation = validateCoords(form.latitude, form.longitude);
    if (!coordsValidation.valid) {
      setSaving(false);
      setError(coordsValidation.message);
      return;
    }

    try {
      const cityInput = form.city_id.trim();
      console.info(`[pending-save][client] pending_id=${pendingFestival.id} city input="${cityInput}"`);

      const nonEmptyOccurrence = occurrenceDays.filter((d) => d.trim().length > 0);
      const mergedDates = mergeOccurrenceDatesWithRange({
        occurrence_days: nonEmptyOccurrence,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });

      const response = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim() || null,
          description: form.description.trim() || null,
          description_short: form.description_short.trim() || null,
          category: form.category.trim() || null,
          city_name_display: cityInput || null,
          city: cityInput || null,
          location_name: form.location_name.trim() || null,
          venue_name: form.venue_name.trim() || null,
          address: form.address.trim() || null,
          latitude: form.latitude.trim() ? Number(form.latitude) : null,
          longitude: form.longitude.trim() ? Number(form.longitude) : null,
          start_date: mergedDates.start_date,
          end_date: mergedDates.end_date,
          start_time: form.start_time.trim() || null,
          end_time: form.end_time.trim() || null,
          occurrence_dates: mergedDates.occurrence_dates,
          organizer_name: organizerEntries[0]?.name.trim() || form.organizer_name.trim() || null,
          organizer_entries: organizerEntries
            .map((e) => ({
              organizer_id: e.organizer_id.trim() || null,
              name: e.name.trim(),
            }))
            .filter((e) => e.name.length > 0),
          source_url: form.source_url.trim() || null,
          website_url: form.website_url.trim() || null,
          ticket_url: form.ticket_url.trim() || null,
          price_range: form.price_range.trim() || null,
          status: form.status.trim() || null,
          is_free: form.is_free,
          hero_image: form.hero_image.trim() || null,
          tags: form.tags,
          video_url: videoUrlExtra.trim() || null,
          gallery_image_urls: galleryUrls,
          program_draft: programDraftHasContent(programDraft) ? compactProgramDraft(programDraft) : null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to save pending festival."));
      }

      setMessage("Changes saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unexpected save error.");
    } finally {
      setSaving(false);
    }
  };

  const onFindCoords = async () => {
    if (saving || runningAction || findingCoords) return;

    const mapsTrimmed = mapsUrlInput.trim();
    if (mapsTrimmed) {
      try {
        const coords = parseGoogleMapsUrl(mapsTrimmed);

        if (coords) {
          updateField("latitude", String(coords.lat));
          updateField("longitude", String(coords.lng));
          setError("");
          setMessage("Координатите са попълнени от Google Maps линк.");
          console.info("[maps-url] parsed", { lat: coords.lat, lng: coords.lng });
          return;
        }

        setMessage("");
        toast.error("Не можахме да извлечем координати от линка");
      } catch (e) {
        setMessage("");
        if (e instanceof Error && e.message === "short-link") {
          toast.error("Отвори линка и копирай пълния Google Maps URL");
        } else {
          toast.error("Невалиден Google Maps линк");
        }
      }
    }

    const plusTrimmed = plusCodeInput.trim();
    if (plusTrimmed) {
      const decoded = decodePlusCode(plusTrimmed);
      if (!decoded) {
        setMessage("");
        toast.error("Невалиден Plus Code.");
        return;
      }
      updateField("latitude", String(decoded.lat));
      updateField("longitude", String(decoded.lng));
      setError("");
      setMessage("Координатите са попълнени от Plus Code.");
      return;
    }

    const city = form.city_id.trim();
    if (!city) {
      setMessage("");
      setError("Попълнете населено място, за да търсите координати.");
      return;
    }

    setFindingCoords(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/geocode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_name: form.venue_name.trim() || null,
          city,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; lat?: number | null; lng?: number | null; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Неуспешно търсене на координати.");
      }

      if (typeof payload.lat === "number" && typeof payload.lng === "number") {
        updateField("latitude", String(payload.lat));
        updateField("longitude", String(payload.lng));
        setMessage("Координатите са намерени.");
      } else {
        setMessage("Не открих координати за тази локация.");
      }
    } catch (geoError) {
      setError(geoError instanceof Error ? geoError.message : "Грешка при търсене на координати.");
    } finally {
      setFindingCoords(false);
    }
  };

  const runDecision = async (action: "approve" | "reject") => {
    if (saving || runningAction) return;

    setRunningAction(action);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: form.city_id.trim() || null,
          tags: form.tags,
        }),
      });

      const payload = (await response.json().catch(() => null)) as (DecisionResponse & ErrorPayload) | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Failed to ${action}. (${response.status})`);
      }

      if (!payload?.ok) {
        throw new Error(payload?.error ?? `Failed to ${action}.`);
      }

      if (action === "approve") {
        const festivalId = payload.festival_id;
        const redirectTo = payload.redirect_to;

        setMessage(festivalId ? `Festival published (id: ${festivalId}). Redirecting…` : "Festival published. Redirecting…");

        if (redirectTo) {
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 500);
          return;
        }

        const encodedFestivalId = festivalId ? encodeURIComponent(festivalId) : "";
        const query = encodedFestivalId ? `?approved=1&festival_id=${encodedFestivalId}` : "?approved=1";
        setTimeout(() => {
          router.push(`/admin/pending-festivals${query}`);
          router.refresh();
        }, 500);
        return;
      } else {
        router.push("/admin/pending-festivals?rejected=1");
      }
      router.refresh();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unexpected action error.");
    } finally {
      setRunningAction(null);
    }
  };

  const uploadHeroImage = async () => {
    if (saving || runningAction || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    if (!heroHasImage && galleryImageCount >= mediaLimits.gallery) {
      setError("Лимитът за галерия е достигнат. Използвайте полето за URL или ъпгрейд към VIP за повече снимки.");
      return;
    }

    const selectedFile = fileInputRef.current?.files?.[0] ?? null;
    if (!selectedFile) {
      setError("Select an image file before uploading.");
      return;
    }

    if (!selectedFile.type.toLowerCase().startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }

    setUploadingHeroImage(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}/hero-image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as HeroImageUploadResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Failed to upload hero image.");
      }

      const uploadedHeroImage = typeof payload.hero_image === "string" ? payload.hero_image : "";
      updateField("hero_image", uploadedHeroImage);
      setHeroImageSourceState(typeof payload.hero_image_source === "string" ? payload.hero_image_source : "manual_upload");
      setMessage("Hero image uploaded successfully.");
      router.refresh();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unexpected hero image upload error.");
    } finally {
      setUploadingHeroImage(false);
    }
  };

  const runHeroImportFromUrl = async (url: string, successMessage: string) => {
    setImportingHeroFromUrl(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}/hero-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: url }),
      });

      const payload = (await response.json().catch(() => null)) as HeroImageUploadResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Failed to import hero image from URL.");
      }

      const importedHeroImage = typeof payload.hero_image === "string" ? payload.hero_image : "";
      updateField("hero_image", importedHeroImage);
      setHeroImageSourceState(typeof payload.hero_image_source === "string" ? payload.hero_image_source : "url_import");
      setMessage(successMessage);
      router.refresh();
    } catch (importUrlError) {
      setError(importUrlError instanceof Error ? importUrlError.message : "Unexpected hero image import error.");
    } finally {
      setImportingHeroFromUrl(false);
    }
  };

  const importHeroImageFromUrl = async () => {
    if (saving || runningAction || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    if (galleryAtLimit && !heroHasImage) {
      setError("Лимитът за снимки е достигнат (включително главното изображение). VIP планът увеличава лимита.");
      return;
    }

    const url = form.hero_image.trim();
    if (!url) {
      setError("Paste an image URL in the Hero image field first.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("Hero image URL must start with http:// or https://.");
      return;
    }

    await runHeroImportFromUrl(url, "Hero image downloaded and saved to storage (external URL was not stored).");
  };

  const importHeroImageFromIngestOriginal = async () => {
    if (saving || runningAction || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    if (galleryAtLimit && !heroHasImage) {
      setError("Лимитът за снимки е достигнат (включително главното изображение). VIP планът увеличава лимита.");
      return;
    }

    if (!ingestOriginalHeroUrl) {
      setError("Няма записан Original URL от ingest.");
      return;
    }
    if (!/^https?:\/\//i.test(ingestOriginalHeroUrl)) {
      setError("Original URL трябва да започва с http:// или https://.");
      return;
    }

    await runHeroImportFromUrl(
      ingestOriginalHeroUrl,
      "Качено от Original URL (ingest).",
    );
  };

  const removeHeroImage = async () => {
    if (saving || runningAction || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    if (!form.hero_image.trim()) {
      setError("There is no hero image to remove.");
      return;
    }

    setRemovingHeroImage(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}/hero-image`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as HeroImageUploadResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Failed to remove hero image.");
      }

      updateField("hero_image", "");
      setHeroImageSourceState(null);
      setMessage("Hero image removed.");
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unexpected hero image remove error.");
    } finally {
      setRemovingHeroImage(false);
    }
  };

  const importPendingGalleryImageFromUrl = async () => {
    const url = galleryImportUrl.trim();
    if (!url) {
      setError("Поставете валиден URL на изображение.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("URL трябва да започва с http:// или https://.");
      return;
    }
    if (saving || runningAction || galleryOpsBusy || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    if (galleryAtLimit) return;

    setImportingGalleryFromUrl(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}/gallery-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: url }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; gallery_image_urls?: string[]; error?: string } | null;
      if (!res.ok || !payload?.ok || !Array.isArray(payload.gallery_image_urls)) {
        throw new Error(payload?.error ?? "Импортът в галерията не бе успешен.");
      }
      setGalleryUrls(payload.gallery_image_urls);
      setGalleryImportUrl("");
      setMessage("Снимката е добавена към галерията.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при импорт в галерията.");
    } finally {
      setImportingGalleryFromUrl(false);
    }
  };

  const uploadPendingGalleryImage = async (file: File) => {
    if (saving || runningAction || galleryOpsBusy || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    setExtraGalleryBusy(true);
    setMessage("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}/gallery-image`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; gallery_image_urls?: string[]; error?: string } | null;
      if (!res.ok || !payload?.ok || !Array.isArray(payload.gallery_image_urls)) {
        throw new Error(payload?.error ?? "Качването в галерията не бе успешно.");
      }
      setGalleryUrls(payload.gallery_image_urls);
      setMessage("Снимката е добавена към галерията.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при качване в галерията.");
    } finally {
      setExtraGalleryBusy(false);
    }
  };

  const removePendingGalleryUrl = async (url: string) => {
    if (saving || runningAction || galleryOpsBusy || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    setExtraGalleryBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(
        `/admin/api/pending-festivals/${pendingFestival.id}/gallery-image?url=${encodeURIComponent(url)}`,
        { method: "DELETE", credentials: "include" },
      );
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; gallery_image_urls?: string[]; error?: string } | null;
      if (!res.ok || !payload?.ok || !Array.isArray(payload.gallery_image_urls)) {
        throw new Error(payload?.error ?? "Премахването от галерията не бе успешно.");
      }
      setGalleryUrls(payload.gallery_image_urls);
      if (form.hero_image.trim() === url.trim()) {
        updateField("hero_image", "");
      }
      setMessage("Снимката е премахната от галерията.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при премахване от галерията.");
    } finally {
      setExtraGalleryBusy(false);
    }
  };

  const savePendingVideoExtra = async (overrideUrl?: string) => {
    if (saving || runningAction || extraVideoBusy || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;
    const raw = overrideUrl !== undefined ? overrideUrl : videoUrlExtra;
    const trimmed = raw.trim();
    if (trimmed && !isSupportedVideoPageUrl(trimmed)) {
      setError("Видео линкът трябва да е публичен YouTube или Facebook адрес.");
      return;
    }
    setExtraVideoBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}/video`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: trimmed || null }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Записът на видео не бе успешен.");
      }
      if (overrideUrl !== undefined) {
        setVideoUrlExtra(trimmed);
      }
      setMessage(trimmed ? "Видео линкът е записан." : "Видео линкът е изчистен.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при запис на видео.");
    } finally {
      setExtraVideoBusy(false);
    }
  };

  const summaryOrganizer = organizerEntries[0]?.name.trim() || form.organizer_name.trim() || "—";

  const firstResolvedOrganizerEntry =
    organizerEntries.find((e) => e.organizer_id && e.organizer_id.trim().length > 0) ?? null;

  const monetizationOrganizerName = organizerConfirmedForPlan
    ? firstResolvedOrganizer?.name.trim() || firstResolvedOrganizerEntry?.name.trim() || "—"
    : "Организаторът не е потвърден";

  const summaryItems = useMemo(() => {
    const cityLine =
      (form.city_id.trim() ||
        (festivalSettlementSourceText({
          cityRelation: pendingFestival.city
            ? { name_bg: pendingFestival.city.name_bg, slug: pendingFestival.city.slug }
            : null,
          city_name_display: typeof pendingFestival.city_name_display === "string" ? pendingFestival.city_name_display : null,
          city_guess: typeof pendingFestival.city_guess === "string" ? pendingFestival.city_guess : null,
        }) ??
          "")) ||
      "—";
    const sourceLine =
      (form.source_type || "").trim() ||
      (form.source_url ? `${form.source_url.slice(0, 64)}${form.source_url.length > 64 ? "…" : ""}` : "—");
    const reviewed =
      pendingFestival.reviewed_at != null && pendingFestival.reviewed_at !== ""
        ? new Date(pendingFestival.reviewed_at).toLocaleString("bg-BG")
        : "—";

    return buildStandardSummaryStripItems({
      status: form.status || "—",
      sourceLine,
      city: cityLine,
      startDate: form.start_date.trim() || "—",
      organizer: summaryOrganizer,
      contextLabel: ADMIN_FIELD_LABEL.reviewedAt,
      contextValue: reviewed,
    });
  }, [
    pendingFestival.city,
    pendingFestival.city_name_display,
    pendingFestival.city_guess,
    pendingFestival.reviewed_at,
    form.city_id,
    form.source_type,
    form.source_url,
    form.start_date,
    form.status,
    summaryOrganizer,
  ]);

  return (
    <form id="admin-pending-festival-edit" onSubmit={onSave} className="space-y-2.5 pb-20">
      <AdminSummaryStrip
        title={form.title.trim() || "Pending festival"}
        eyebrow="Admin · Pending festival"
        items={summaryItems}
        actions={
          <>
            <Link
              href="/admin/pending-festivals"
              className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]"
            >
              Back
            </Link>
            <button
              type="submit"
              form="admin-pending-festival-edit"
              disabled={Boolean(runningAction) || saving || galleryOpsBusy || extraVideoBusy}
              className="rounded-xl bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save edits"}
            </button>
            <button
              type="button"
              onClick={() => runDecision("reject")}
              disabled={saving || Boolean(runningAction)}
              className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
            >
              {runningAction === "reject" ? "Rejecting..." : "Reject"}
            </button>
            <button
              type="button"
              onClick={() => runDecision("approve")}
              disabled={saving || Boolean(runningAction)}
              className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
            >
              {runningAction === "approve" ? "Approving..." : "Approve"}
            </button>
          </>
        }
      />

      <AdminMonetizationSummaryCard
        organizerName={monetizationOrganizerName}
        planLabel={organizerConfirmedForPlan ? planLabel : null}
        gallerySlots={organizerConfirmedForPlan ? { used: totalGallerySlotsUsed, limit: mediaLimits.gallery } : null}
        videos={organizerConfirmedForPlan ? { used: videoCount, limit: mediaLimits.video } : null}
        promotion={{
          status: pendingFestival.promotion_status === "promoted" ? "promoted" : "normal",
          expiresAtInput: pendingFestival.promotion_expires_at,
        }}
      />

      {pendingFestival.submission_source === "organizer_portal" ? (
        <div className="rounded-xl border border-[#0c0e14]/15 bg-[#f7f6f3] p-3 text-sm text-[#0c0e14]">
          <p className="font-semibold">Подаване от организаторски портал</p>
          {typeof pendingFestival.submitted_by_user_id === "string" && pendingFestival.submitted_by_user_id ? (
            <p className="mt-1 font-mono text-xs text-black/55">Потребител (auth id): {pendingFestival.submitted_by_user_id}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2.5">
        <AdminFieldSection
          title={ADMIN_ENTITY_SECTION.mainInfo.title}
          description="Title, moderation status, category, and tags."
          variant={ADMIN_ENTITY_SECTION.mainInfo.variant}
        >
          <AdminFieldGrid>
            <label className="md:col-span-2">
              <AdminFieldLabel field="title" />
              <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} required />
            </label>
            <AdminFieldInlineRow field="slug">
              <input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </AdminFieldInlineRow>
            <AdminFieldInlineRow field="category">
              <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </AdminFieldInlineRow>
            <AdminFieldInlineRow field="status">
              <input value={form.status} onChange={(e) => updateField("status", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </AdminFieldInlineRow>
            <AdminFieldInlineRow as="div" field="isFree">
              <input
                type="checkbox"
                checked={form.is_free}
                onChange={(e) => updateField("is_free", e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border border-black/20 text-[#0c0e14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c0e14]"
                aria-label={getAdminFieldLabel("isFree")}
              />
            </AdminFieldInlineRow>
            <label className="md:col-span-2">
              <AdminFieldLabel field="tags" />
              <div className="mt-0">
                <TagsInput value={form.tags} onChange={(tags) => updateField("tags", tags)} />
              </div>
            </label>
          </AdminFieldGrid>
        </AdminFieldSection>

        <AdminFieldSection title={ADMIN_ENTITY_SECTION.dateTime.title} variant={ADMIN_ENTITY_SECTION.dateTime.variant}>
          <AdminFieldGrid>
            <AdminFieldInlineRow field="startDate">
              <DdMmYyyyDateInput
                value={form.start_date ?? ""}
                onChange={(iso) => updateField("start_date", iso)}
                className={ADMIN_ENTITY_CONTROL_CLASS}
                visualVariant="dots"
              />
            </AdminFieldInlineRow>
            <AdminFieldInlineRow field="endDate">
              <DdMmYyyyDateInput
                value={form.end_date ?? ""}
                onChange={(iso) => updateField("end_date", iso)}
                className={ADMIN_ENTITY_CONTROL_CLASS}
                visualVariant="dots"
              />
            </AdminFieldInlineRow>
            <AdminFieldInlineRow field="startTime">
              <span className="sr-only">HH:mm</span>
              <AdminTimeInput value={form.start_time} onChange={(e) => updateField("start_time", e.target.value)} />
            </AdminFieldInlineRow>
            <AdminFieldInlineRow field="endTime">
              <span className="sr-only">HH:mm</span>
              <AdminTimeInput value={form.end_time} onChange={(e) => updateField("end_time", e.target.value)} />
            </AdminFieldInlineRow>
            <div className="md:col-span-2">
              <AdminFieldLabel field="occurrenceDays" />
              <div className="mt-0">
                <OccurrenceDaysEditor
                  value={occurrenceDays}
                  onChange={setOccurrenceDays}
                  disabled={saving || Boolean(runningAction)}
                />
              </div>
            </div>
          </AdminFieldGrid>
        </AdminFieldSection>

        <AdminFieldSection
          title="Програма и разписание"
          description="Публично разписание по часове. При одобрение става видимо в каталога като отделни дни и точки в програмата."
          variant="default"
        >
          <ProgramDraftEditor value={programDraft} onChange={setProgramDraft} />
        </AdminFieldSection>

        <AdminFieldSection
          title={ADMIN_ENTITY_SECTION.location.title}
          description="Settlement resolution, venue, address, and map coordinates."
          variant={ADMIN_ENTITY_SECTION.location.variant}
        >
          <AdminFieldGrid>
            <div className="md:col-span-2 space-y-1.5">
              <AdminFieldInlineRow field="cityId">
                <input
                  value={form.city_id}
                  onChange={(e) => {
                    updateField("city_id", e.target.value);
                  }}
                  className={ADMIN_ENTITY_CONTROL_CLASS}
                />
              </AdminFieldInlineRow>
              {pendingFestival.city_id === null && normalizeDisplayValue(form.city_id) ? (
                <p className="text-xs text-black/50">Unresolved settlement (free text)</p>
              ) : null}
            </div>
            <label className="md:col-span-2">
              <AdminFieldLabel field="locationName" />
              <input value={form.venue_name} onChange={(e) => updateField("venue_name", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </label>
            <label className="md:col-span-2">
              <AdminFieldLabel field="address" />
              <input value={form.address} onChange={(e) => updateField("address", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </label>
            <label className="md:col-span-2">
              <AdminFieldLabel field="plusCode" />
              <input
                value={plusCodeInput}
                onChange={(e) => setPlusCodeInput(e.target.value)}
                placeholder="напр. 8FVCGGGC+GG"
                className={ADMIN_ENTITY_CONTROL_CLASS}
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55">Google Maps URL</span>
              <input
                value={mapsUrlInput}
                onChange={(e) => setMapsUrlInput(e.target.value)}
                placeholder="https://www.google.com/maps/place/…/@lat,lng,…"
                className={ADMIN_ENTITY_CONTROL_CLASS}
              />
            </label>
            <label>
              <AdminFieldLabel field="latitude" />
              <input value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </label>
            <label>
              <AdminFieldLabel field="longitude" />
              <input value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </label>
          </AdminFieldGrid>
          <div className="mt-2">
            <button
              type="button"
              onClick={onFindCoords}
              disabled={findingCoords || saving || Boolean(runningAction)}
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {findingCoords ? "Търсене..." : "Намери координати"}
            </button>
          </div>
        </AdminFieldSection>

        <AdminFieldSection
          title={ADMIN_ENTITY_SECTION.organizer.title}
          description="Catalog links, manual names, or inline organizer creation."
          variant={ADMIN_ENTITY_SECTION.organizer.variant}
        >
              <div className="rounded-xl border border-black/[0.08] bg-[#fafafa] p-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">{orgLabel}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {organizerEntries.map((entry, index) => (
                    <span
                      key={`${entry.organizer_id}-${index}-${entry.name}`}
                      className="inline-flex items-center gap-1 rounded-full border border-black/[0.12] bg-white px-2.5 py-1 text-sm text-black/85"
                    >
                      <input
                        value={entry.name}
                        onChange={(e) => updateOrganizerNameAt(index, e.target.value)}
                        className="max-w-[220px] border-0 bg-transparent p-0 text-sm outline-none"
                        aria-label={`Име организатор ${index + 1}`}
                      />
                      {entry.organizer_id ? (
                        <Link href={`/admin/organizers/${entry.organizer_id}`} className="text-[11px] font-semibold text-[#0e7a45]">
                          профил
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeOrganizerAt(index)}
                        className="text-xs text-black/45 hover:text-[#b13a1a]"
                        aria-label="Премахни"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <input
                    value={organizerSearch}
                    onChange={(e) => setOrganizerSearch(e.target.value)}
                    placeholder="Търсене в каталога…"
                    className="w-full min-w-[180px] flex-1 rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm sm:max-w-xs"
                  />
                  <select
                    value={pendingOrganizerPickId}
                    onChange={(e) => setPendingOrganizerPickId(e.target.value)}
                    className="w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm sm:w-auto"
                  >
                    <option value="">Избери организатор…</option>
                    {availableOrganizerOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => pendingOrganizerPickId && addOrganizerById(pendingOrganizerPickId)}
                    disabled={!pendingOrganizerPickId}
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-40"
                  >
                    Добави избрания
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={manualOrganizerName}
                    onChange={(e) => setManualOrganizerName(e.target.value)}
                    placeholder="Име без запис в каталога"
                    className={`min-w-[200px] flex-1 ${ADMIN_ENTITY_CONTROL_BASE}`}
                  />
                  <button type="button" onClick={addManualOrganizer} className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold text-white">
                    Добави по име
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/[0.06] pt-3">
                  <label className="flex min-w-[200px] flex-1 flex-col text-xs font-semibold uppercase tracking-[0.1em] text-black/55">
                    Нов организатор (каталог)
                    <input
                      value={newOrganizerName}
                      onChange={(e) => setNewOrganizerName(e.target.value)}
                      className={`mt-1 ${ADMIN_ENTITY_CONTROL_CLASS} font-normal normal-case`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onCreateOrganizerInline}
                    disabled={creatingOrganizer || !newOrganizerName.trim()}
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  >
                    {creatingOrganizer ? "…" : "Създай и добави"}
                  </button>
                </div>
              </div>
        </AdminFieldSection>

        <AdminFieldSection
          title={ADMIN_ENTITY_SECTION.linksSources.title}
          description="Canonical URLs, ingest source, and ticket links."
          variant={ADMIN_ENTITY_SECTION.linksSources.variant}
        >
          <AdminFieldGrid>
              <label className="md:col-span-2">
                <AdminFieldLabel field="sourceUrl" />
                <input value={form.source_url} onChange={(e) => updateField("source_url", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
                {lastIngestSummary ? (
                  <p className="mt-2 text-xs text-black/60" title="От съответния ред в Ingest queue (същият source_url)">
                    Последен ingest: {lastIngestSummary}
                  </p>
                ) : form.source_url.trim() ? (
                  <p className="mt-2 text-xs text-black/50">
                    Няма намерен ingest job с този точен source_url — виж <span className="font-medium">/admin/ingest</span>.
                  </p>
                ) : null}
              </label>
              <label>
                <AdminFieldLabel field="websiteUrl" />
                <input value={form.website_url} onChange={(e) => updateField("website_url", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="ticketUrl" />
                <input value={form.ticket_url} onChange={(e) => updateField("ticket_url", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="priceRange" />
                <input value={form.price_range} onChange={(e) => updateField("price_range", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
              </label>
          </AdminFieldGrid>
        </AdminFieldSection>

        <AdminFieldSection title={ADMIN_ENTITY_SECTION.media.title} variant={ADMIN_ENTITY_SECTION.media.variant}>
              {/* Hero */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Главно изображение</p>
                {heroImageUrl ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
                    {heroPreviewError ? (
                      <p className="p-4 text-sm text-black/60">Прегледът не е наличен за този адрес.</p>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={heroImageUrl}
                        src={heroImageUrl}
                        alt=""
                        className="max-h-[320px] w-full object-cover"
                        onLoad={() => setHeroPreviewError(false)}
                        onError={() => setHeroPreviewError(true)}
                      />
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-black/45">Няма избрано главно изображение.</p>
                )}
                <label className="mt-3 block">
                  <AdminFieldLabel field="heroImage" />
                  <input value={form.hero_image} onChange={(e) => updateField("hero_image", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
                </label>
                <div className="mt-3 rounded-xl border border-black/[0.08] bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="text-xs" />
                    <button
                      type="button"
                      onClick={uploadHeroImage}
                      disabled={
                        saving ||
                        Boolean(runningAction) ||
                        uploadingHeroImage ||
                        importingHeroFromUrl ||
                        removingHeroImage ||
                        (!heroHasImage && galleryImageCount >= mediaLimits.gallery)
                      }
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {uploadingHeroImage ? "Качване..." : heroImageUrl ? "Замени файл" : "Качи файл"}
                    </button>
                    <button
                      type="button"
                      onClick={importHeroImageFromUrl}
                      disabled={
                        saving ||
                        Boolean(runningAction) ||
                        galleryOpsBusy ||
                        uploadingHeroImage ||
                        importingHeroFromUrl ||
                        removingHeroImage ||
                        !heroImageUrl ||
                        (galleryAtLimit && !heroHasImage)
                      }
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {importingHeroFromUrl ? "Импорт..." : "Импорт от URL"}
                    </button>
                    <button
                      type="button"
                      onClick={importHeroImageFromIngestOriginal}
                      disabled={
                        saving ||
                        Boolean(runningAction) ||
                        galleryOpsBusy ||
                        uploadingHeroImage ||
                        importingHeroFromUrl ||
                        removingHeroImage ||
                        !canImportFromIngestOriginal ||
                        (galleryAtLimit && !heroHasImage)
                      }
                      title="Ползва полето Original URL по-долу (от ingest), без да го копираш в главното изображение"
                      className="rounded-lg border border-[#18a05e]/35 bg-[#18a05e]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0e7a45] disabled:opacity-50"
                    >
                      {importingHeroFromUrl ? "Импорт..." : "Импорт от original URL"}
                    </button>
                    <button
                      type="button"
                      onClick={removeHeroImage}
                      disabled={saving || Boolean(runningAction) || uploadingHeroImage || importingHeroFromUrl || removingHeroImage || !heroImageUrl}
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {removingHeroImage ? "Премахване..." : "Премахни"}
                    </button>
                    <span
                      className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-black/[0.12] text-[10px] font-bold text-black/45"
                      title="Импортът от външен URL сваля файла на сървъра и записва публичен адрес. За Facebook CDN понякога сървърът получава HTML вместо снимка — тогава отвори линка по-долу (логнат във FB), запази изображението и ползвай „Качи файл“, или остави ingest да рехостне с браузър контекст."
                    >
                      i
                    </span>
                  </div>
                </div>
                {heroImageUrl || hasHeroImageDiagnostics ? (
                  <details className="mt-2 rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-xs text-black/65">
                    <summary className="cursor-pointer font-semibold text-black/55">Подробности от извличането</summary>
                    <p className="mt-2">
                      Статус: <span className="font-semibold text-black/80">{heroImageStatus}</span>
                    </p>
                    <p>
                      Източник: <span className="font-semibold text-black/80">{heroImageSource ?? "—"}</span>
                    </p>
                    <p>
                      Оценка: <span className="font-semibold text-black/80">{heroImageScore ?? "—"}</span>
                    </p>
                    <p className="truncate">
                      Original URL:{" "}
                      {heroImageOriginalUrl ? (
                        <a href={heroImageOriginalUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#0c0e14] underline underline-offset-2">
                          {heroImageOriginalUrl}
                        </a>
                      ) : (
                        <span className="font-semibold text-black/80">—</span>
                      )}
                    </p>
                  </details>
                ) : null}
              </div>

              {/* Gallery */}
              <div className="mt-6 border-t border-black/[0.08] pt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Галерия</p>
                  <p className="text-xs text-black/60">
                    <span className="font-semibold text-black/80">{totalGallerySlotsUsed}</span> / {mediaLimits.gallery} · {planLabel}
                  </p>
                </div>
                <input
                  ref={galleryExtraInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadPendingGalleryImage(f);
                  }}
                />
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {galleryUrls.map((u) => {
                    const isHero = heroImageUrl === u.trim();
                    return (
                      <div
                        key={u}
                        className={`group relative overflow-hidden rounded-xl border bg-black/[0.02] ${
                          isHero ? "border-[#ff4c1f]/50 ring-2 ring-[#ff4c1f]/25" : "border-black/[0.08]"
                        }`}
                      >
                        <div className="aspect-square w-full overflow-hidden bg-black/[0.04]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-1 border-t border-black/[0.06] bg-white/95 p-1.5">
                          {isHero ? (
                            <span className="rounded-md border border-[#ff4c1f]/40 bg-[#ff4c1f]/10 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#c43a1a]">
                              Главна
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateField("hero_image", u)}
                              disabled={saving || Boolean(runningAction) || galleryOpsBusy || uploadingHeroImage || importingHeroFromUrl || removingHeroImage}
                              className="rounded-md border border-black/[0.1] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
                            >
                              Направи главна
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void removePendingGalleryUrl(u)}
                            disabled={
                              saving ||
                              Boolean(runningAction) ||
                              galleryOpsBusy ||
                              uploadingHeroImage ||
                              importingHeroFromUrl ||
                              removingHeroImage
                            }
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-700 disabled:opacity-50"
                          >
                            Премахни
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => galleryExtraInputRef.current?.click()}
                    disabled={
                      saving ||
                      Boolean(runningAction) ||
                      galleryOpsBusy ||
                      uploadingHeroImage ||
                      importingHeroFromUrl ||
                      removingHeroImage ||
                      galleryAtLimit
                    }
                    className="flex aspect-square min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/[0.15] bg-black/[0.02] text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55 transition hover:border-black/[0.25] hover:bg-black/[0.04] disabled:opacity-50"
                  >
                    {extraGalleryBusy ? "Качване..." : "+ Качи"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={galleryImportUrl}
                    onChange={(e) => setGalleryImportUrl(e.target.value)}
                    placeholder="https://… (импорт в галерията)"
                    className={`min-w-[200px] flex-1 ${ADMIN_ENTITY_CONTROL_CLASS}`}
                  />
                  <button
                    type="button"
                    onClick={() => void importPendingGalleryImageFromUrl()}
                    disabled={
                      saving ||
                      Boolean(runningAction) ||
                      galleryOpsBusy ||
                      uploadingHeroImage ||
                      importingHeroFromUrl ||
                      removingHeroImage ||
                      galleryAtLimit ||
                      !galleryImportUrl.trim()
                    }
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                  >
                    {importingGalleryFromUrl ? "Импорт..." : "Импорт от URL"}
                  </button>
                  <span
                    className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-black/[0.12] text-[10px] font-bold text-black/45"
                    title="Сървърът сваля изображението и го записва в storage (като при главното изображение)."
                  >
                    i
                  </span>
                </div>
                {mediaPlan === "free" && galleryAtLimit ? (
                  <p className="mt-2 text-xs text-[#c9a227]">VIP планът увеличава лимита до {MEDIA_LIMITS.vip.gallery} снимки.</p>
                ) : null}
                {!galleryUrls.length ? <p className="mt-2 text-xs text-black/45">Няма снимки в галерията.</p> : null}
              </div>

              {/* Video: external URL only (stored on pending_festivals.video_url) */}
              <div className="mt-6 border-t border-black/[0.08] pt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Видео линк</p>
                    <p className="mt-1 max-w-xl text-xs text-black/50">
                      Публичен YouTube или Facebook URL. Не се качва видео файл; при одобрение се прехвърля в публикувания фестивал.
                    </p>
                  </div>
                  <p className="text-xs text-black/60">
                    <span className="font-semibold text-black/80">{videoCount}</span> / {mediaLimits.video} · {planLabel}
                  </p>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55">URL на видеото</span>
                  <input
                    value={videoUrlExtra}
                    onChange={(e) => setVideoUrlExtra(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=… или Facebook видео линк"
                    className={ADMIN_ENTITY_CONTROL_CLASS}
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void savePendingVideoExtra()}
                    disabled={
                      saving ||
                      Boolean(runningAction) ||
                      extraVideoBusy ||
                      uploadingHeroImage ||
                      importingHeroFromUrl ||
                      removingHeroImage
                    }
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                  >
                    {extraVideoBusy ? "Запис..." : "Запиши"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void savePendingVideoExtra("")}
                    disabled={
                      saving ||
                      Boolean(runningAction) ||
                      extraVideoBusy ||
                      uploadingHeroImage ||
                      importingHeroFromUrl ||
                      removingHeroImage ||
                      !videoUrlExtra.trim()
                    }
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                  >
                    {extraVideoBusy ? "Запис..." : "Премахни видео"}
                  </button>
                </div>
                {videoEmbedSrc ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-black/[0.08] bg-black">
                    <div className="relative aspect-video w-full">
                      <iframe
                        title="Видео преглед"
                        src={videoEmbedSrc}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  </div>
                ) : null}
                {mediaPlan === "free" && videoCount >= MEDIA_LIMITS.free.video ? (
                  <p className="mt-2 text-xs text-[#c9a227]">VIP планът увеличава лимита до {MEDIA_LIMITS.vip.video} видеа.</p>
                ) : null}
              </div>
        </AdminFieldSection>

        <AdminFieldSection
          title={ADMIN_ENTITY_SECTION.descriptionContent.title}
          description="Пълно и кратко описание за публикуване и карта в списък."
          variant={ADMIN_ENTITY_SECTION.descriptionContent.variant}
        >
          <AdminFestivalDescriptionFields
            fullLabel="Пълно описание"
            shortLabel="Кратко описание (за списъци и SEO)"
            fullValue={form.description}
            shortValue={form.description_short}
            onFullChange={(v) => updateField("description", v)}
            onShortChange={(v) => updateField("description_short", v)}
            previewTitle={form.title}
          />
        </AdminFieldSection>

          <details className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-sm">
            <summary className="cursor-pointer text-sm font-semibold text-black/70">Secondary moderation metadata (collapsed)</summary>
            <p className="mt-1 text-xs text-black/60">ID, източници, verification, одит. Само за преглед.</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label>
                <AdminFieldLabel field="recordId" />
                <input value={pendingFestival.id} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="sourcePrimaryUrl" />
                <input value={form.source_primary_url} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="sourceCount" />
                <input value={form.source_count} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="sourceType" />
                <input value={form.source_type} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label className="md:col-span-2">
                <AdminFieldLabel field="discoveredVia" />
                <input value={form.discovered_via} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="verificationStatus" />
                <input value={form.verification_status} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="verificationScore" />
                <input value={form.verification_score} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="duplicateOf" />
                <input value={form.duplicate_of} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="createdAt" />
                <input value={form.created_at} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="reviewedAt" />
                <input value={form.reviewed_at} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label className="md:col-span-2">
                <AdminFieldLabel field="reviewedBy" />
                <input value={form.reviewed_by} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
            </div>
          </details>

          <details className="rounded-xl border border-[#0c0e14]/[0.12] bg-[#f8f9fc] p-3 text-sm">
            <summary className="cursor-pointer text-sm font-semibold text-black/65">Debug / normalization / ingestion (collapsed)</summary>
            <p className="mt-1 text-xs text-black/60">Advisory diagnostics and extraction traces. Read-only by default.</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-black/70 sm:grid-cols-3">
              <p className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5">Version: <span className="font-semibold text-black/80">{pendingFestival.normalization_version ?? "-"}</span></p>
              <p className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5">Applicable: <span className="font-semibold text-black/80">{applicableSuggestionCount}</span></p>
              <p className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5">Safe: <span className="font-semibold text-black/80">{safeSuggestionCount}</span></p>
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label>
                <AdminFieldLabel field="descriptionClean" />
                <textarea value={form.description_clean} readOnly rows={3} className={ADMIN_ENTITY_TEXTAREA_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="categoryGuess" />
                <input value={form.category_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="tagsGuess" />
                <input value={form.tags_guess.join(", ")} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="cityGuess" />
                <input value={form.city_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">is_free (guess)</span>
                <input value={pendingFestival.is_free_guess === null ? "" : pendingFestival.is_free_guess ? "true" : "false"} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="heroImageSource" />
                <input value={form.hero_image_source} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="titleClean" />
                <input value={form.title_clean} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="locationGuess" />
                <input value={form.location_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="dateGuess" />
                <input value={form.date_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Title (guess)</span>
                <input value={form.title_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Latitude (guess)</span>
                <input value={form.latitude_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Longitude (guess)</span>
                <input value={form.longitude_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Address (guess)</span>
                <input value={form.address_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">lat (guess)</span>
                <input value={form.lat_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">lng (guess)</span>
                <input value={form.lng_guess} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="heroImageOriginalUrl" />
                <input value={form.hero_image_original_url} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="heroImageScore" />
                <input value={form.hero_image_score} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="normalizationVersion" />
                <input value={form.normalization_version} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
              <label>
                <AdminFieldLabel field="extractionVersion" />
                <input value={form.extraction_version} readOnly className={ADMIN_ENTITY_CONTROL_READONLY_CLASS} />
              </label>
            </div>

            <div className="mt-2 space-y-1.5">
              <details className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-2">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">deterministic_guess_json</summary>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-white p-2 text-xs text-black/75">{prettyJson(pendingFestival.deterministic_guess_json)}</pre>
              </details>
              <details className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-2">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">ai_guess_json</summary>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-white p-2 text-xs text-black/75">{prettyJson(pendingFestival.ai_guess_json)}</pre>
              </details>
              <details className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-2">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">merge_decisions_json</summary>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-white p-2 text-xs text-black/75">{prettyJson(pendingFestival.merge_decisions_json)}</pre>
              </details>
              <details className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-2">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">evidence_json</summary>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-white p-2 text-xs text-black/75">{prettyJson(pendingFestival.evidence_json)}</pre>
              </details>
            </div>

            {hasNormalizeSuggestions ? (
              <>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={applySafeSuggestions}
                    className="rounded-lg border border-black/15 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  >
                    {safeSuggestionsTouchAi ? `Apply safe (${pendingResearchProviderLabel})` : "Apply safe suggestions"}
                  </button>
                  {safeApplySummary ? (
                    <div className="mt-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs text-black/70">
                      <p>Fields applied: {safeApplySummary.appliedFields.length > 0 ? safeApplySummary.appliedFields.join(", ") : "none"}</p>
                      <p>
                        Skipped (unchanged or missing):{" "}
                        {safeApplySummary.skippedUnchangedOrMissing.length > 0 ? safeApplySummary.skippedUnchangedOrMissing.join(", ") : "none"}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  {suggestionRows.map(({ suggestion, currentValue, suggestedValue, comparisonStatus, isApplied, canApply }) => {
                    const cardTone = isApplied
                      ? "border-[#18a05e]/30 bg-[#18a05e]/5"
                      : comparisonStatus === "matches"
                        ? "border-black/[0.08] bg-black/[0.03]"
                        : comparisonStatus === "different"
                          ? "border-[#0c0e14]/20 bg-white"
                          : "border-[#b13a1a]/20 bg-[#fff6f3]";

                    return (
                      <div key={suggestion.field} className={`rounded-lg border px-2.5 py-2 ${cardTone}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                              {adminLabelForSuggestionField(suggestion.field)}
                            </p>
                            <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/60">
                              {suggestionStateLabel(comparisonStatus, isApplied)}
                            </span>
                            <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/60">
                              Source: {formatNormalizationSourceLabel(suggestion.source, pendingResearchProviderLabel)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => applySuggestion(suggestion.field, suggestion.value)}
                            disabled={!canApply}
                            className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {suggestionApplyButtonLabel(isApplied, suggestion.source, pendingResearchProviderLabel)}
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-black/70">Current: {currentValue ?? "-"}</p>
                        <p className="mt-1 text-sm text-black/85">Suggested: {suggestedValue}</p>
                        {suggestion.confidence !== null ? <p className="mt-1 text-xs text-black/60">Confidence: {suggestion.confidence}</p> : null}
                        {suggestion.warning ? <p className="mt-1 text-xs text-[#b13a1a]">Warning: {suggestion.warning}</p> : null}
                        {suggestion.reason ? <p className="mt-1 text-xs text-black/60">Reason: {suggestion.reason}</p> : null}
                        {statusBadgeLabel(comparisonStatus) ? <p className="mt-1 text-xs text-black/55">Status: {statusBadgeLabel(comparisonStatus)}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : hasNormalizationData ? (
              <p className="mt-3 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs text-black/70">
                No applicable suggestions were parsed from available normalization data.
              </p>
            ) : (
              <p className="mt-3 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs text-black/70">
                No normalization data available for this pending record yet.
              </p>
            )}
          </details>

          <div className="rounded-xl border border-[#18a05e]/25 bg-[#f4fbf7] p-3 text-sm">
            <h2 className="text-base font-bold">Попълнени полета</h2>
            <p className="mt-1 text-xs text-black/60">
              Какво има в записа към момента на зареждане на страницата (ingest worker
              {pendingResearchProviderKey ? ` + нормализация · ${pendingResearchProviderLabel}` : " + нормализация"}). Празните полета не се изреждат тук — за тях виж
              „Missing fields“ по-долу.
            </p>
            {filledFieldSummaries.length > 0 ? (
              <ul className="mt-2 max-h-[min(420px,50vh)] list-none space-y-1.5 overflow-y-auto pr-1">
                {filledFieldSummaries.map((f) => (
                  <li key={f.key} className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/50">{f.label}</span>
                    <p className="mt-1 break-all font-mono text-[11px] leading-snug text-black/75">{f.preview}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-black/55">Няма ненулеви полета в записа.</p>
            )}
          </div>

          <div className="rounded-xl border border-[#0c0e14]/[0.14] bg-[#f8f9fc] p-3 text-sm">
            <h2 className="text-base font-bold">Pending quality diagnostics</h2>
            <p className="mt-1 text-xs text-black/60">Derived score for moderation prioritization only. It does not change approve/reject behavior.</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${qualityBucketTone(qualityDiagnostics.quality_bucket)}`}>
                {qualityBucketLabel(qualityDiagnostics.quality_bucket)}
              </span>
              <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-black/70">
                Score: {qualityDiagnostics.quality_score}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${qualityDiagnostics.hero_image_missing ? "border-[#b13a1a]/30 bg-[#fff1ec] text-[#9f3115]" : "border-[#18a05e]/30 bg-[#18a05e]/10 text-[#0e7a45]"}`}>
                Hero image: {qualityDiagnostics.hero_image_missing ? "Missing" : "Present"}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Missing fields</p>
              {qualityDiagnostics.missing_fields.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {qualityDiagnostics.missing_fields.map((field) => (
                    <span key={field} className="rounded-full border border-[#b13a1a]/25 bg-[#fff1ec] px-2 py-0.5 text-[11px] text-[#9f3115]">
                      {field}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#0e7a45]">No critical missing fields detected.</p>
              )}
            </div>

            <div className="mt-3 grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Guessed normalization values</p>
              <div className="grid gap-1.5">
                {guessedPairs.map((entry) => (
                  <p key={entry.label} className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs text-black/70">
                    {entry.label}: <span className="font-semibold text-black/80">{entry.value ?? "-"}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Autofill reuse signal</p>
              <p className="mt-1 text-xs text-black/70">
                {qualityDiagnostics.autofilled_fields.length > 0
                  ? `Already aligned with guesses: ${qualityDiagnostics.autofilled_fields.join(", ")}`
                  : "No clear autofill-aligned fields detected yet."}
              </p>
            </div>

            <div className="mt-3 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs text-black/70">
              Scoring guide: title (16), description (14), start date (16), end date (8), city (12/8 guessed), location (10/7 guessed), organizer (8), hero image (8), category/tags (8), date guess fallback (+4).
            </div>
          </div>

        </div>

      {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-end gap-2 px-4 py-2.5 md:px-6">
          <Link href="/admin/pending-festivals" className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
            Back
          </Link>
          <FestivalEditorOpenSecondary
            action={editorOpenAction}
            dimmed={
              saving ||
              Boolean(runningAction) ||
              uploadingHeroImage ||
              importingHeroFromUrl ||
              removingHeroImage ||
              galleryOpsBusy ||
              extraVideoBusy
            }
          />
          <button
            type="button"
            onClick={() => runDecision("reject")}
            disabled={saving || Boolean(runningAction)}
            className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            {runningAction === "reject" ? "Rejecting..." : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => runDecision("approve")}
            disabled={saving || Boolean(runningAction)}
            className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            {runningAction === "approve" ? "Approving..." : "Approve"}
          </button>
          <button
            type="submit"
            disabled={Boolean(runningAction) || saving || galleryOpsBusy || extraVideoBusy}
            className="rounded-xl bg-[#0c0e14] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save edits"}
          </button>
        </div>
      </div>
    </form>
  );
}
