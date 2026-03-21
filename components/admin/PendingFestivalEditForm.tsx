"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TagsInput from "@/components/admin/TagsInput";
import { extractNormalizationSuggestions, type SuggestionField } from "@/lib/festival/normalizationSuggestions";
import type { PendingFestivalQuality } from "@/lib/admin/pendingFestivalQuality";

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
  region?: string | null;
  source_type?: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  organizer_name: string | null;
  source_url: string | null;
  is_free: boolean | null;
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
  [key: string]: unknown;
};

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

function fieldLabel(field: SuggestionField) {
  const labels: Record<SuggestionField, string> = {
    category: "Category",
    tags: "Tags",
    venue_name: "Venue name",
    region: "Region",
    city_id: "City",
    start_date: "Start date",
    end_date: "End date",
    organizer_name: "Organizer name",
    source_url: "Source URL",
    website_url: "Website URL",
    ticket_url: "Ticket URL",
  };

  return labels[field];
}

function normalizeSourceLabel(source: "merge" | "ai" | "deterministic") {
  if (source === "ai") return "AI";
  if (source === "merge") return "Merge";
  return "Deterministic";
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
}: {
  pendingFestival: PendingFestivalRecord;
  qualityDiagnostics: PendingFestivalQuality;
  lastIngestJobMeta?: LastIngestJobMeta | null;
}) {
  const router = useRouter();
  const tagsCurrent = normalizeTagsGuess(pendingFestival.tags);
  const cityDisplayValue =
    normalizeDisplayValue(pendingFestival.city?.name_bg) ??
    normalizeDisplayValue(pendingFestival.city?.slug) ??
    "";

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
    region: (typeof pendingFestival.region === "string" ? pendingFestival.region : "") ?? "",
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
  const [runningAction, setRunningAction] = useState<"approve" | "reject" | null>(null);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [importingHeroFromUrl, setImportingHeroFromUrl] = useState(false);
  const [removingHeroImage, setRemovingHeroImage] = useState(false);
  const [heroImageSourceState, setHeroImageSourceState] = useState<string | null>(normalizeOptionalText(pendingFestival.hero_image_source));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [safeApplySummary, setSafeApplySummary] = useState<{ appliedFields: string[]; skippedUnchangedOrMissing: string[] } | null>(null);
  const lastIngestSummary = formatLastIngestLine(lastIngestJobMeta);

  const [heroPreviewError, setHeroPreviewError] = useState(false);
  const [appliedAiFields, setAppliedAiFields] = useState<Record<SuggestionField, boolean>>({
    category: false,
    tags: false,
    venue_name: false,
    region: false,
    city_id: false,
    start_date: false,
    end_date: false,
    organizer_name: false,
    source_url: false,
    website_url: false,
    ticket_url: false,
  });

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
  const heroImageOriginalUrl = normalizeOptionalText(pendingFestival.hero_image_original_url);
  const heroImageScore = normalizeOptionalScore(pendingFestival.hero_image_score);
  const hasHeroImageDiagnostics = heroImageSource !== null || heroImageScore !== null || heroImageOriginalUrl !== null;
  const heroImageStatus = !heroImageUrl
    ? "No hero image selected by ingestion"
    : hasHeroImageDiagnostics
      ? "Hero image selected"
      : "Hero image present, diagnostics unavailable";
  const safeFields: SuggestionField[] = ["category", "tags", "venue_name", "region"];

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
        skippedUnchangedOrMissing.push(fieldLabel(field));
        continue;
      }

      const currentValue = getCurrentValue(field);
      const suggestionValue = Array.isArray(suggestion.value) ? suggestion.value.join(", ") : suggestion.value;
      const normalizedSuggested = normalizeDisplayValue(suggestionValue);
      const comparisonStatus: SuggestionComparisonStatus = getComparisonStatus(currentValue, normalizedSuggested);
      const canApply = comparisonStatus !== "matches" && comparisonStatus !== "empty";

      if (!canApply) {
        skippedUnchangedOrMissing.push(fieldLabel(field));
        continue;
      }

      const didApply = applySuggestion(field, suggestion.value);
      if (didApply) {
        appliedFields.push(fieldLabel(field));
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

      const response = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim() || null,
          description: form.description.trim() || null,
          category: form.category.trim() || null,
          city_name_display: cityInput || null,
          city: cityInput || null,
          region: form.region.trim() || null,
          location_name: form.location_name.trim() || null,
          venue_name: form.venue_name.trim() || null,
          address: form.address.trim() || null,
          latitude: form.latitude.trim() ? Number(form.latitude) : null,
          longitude: form.longitude.trim() ? Number(form.longitude) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          organizer_name: form.organizer_name.trim() || null,
          source_url: form.source_url.trim() || null,
          website_url: form.website_url.trim() || null,
          ticket_url: form.ticket_url.trim() || null,
          price_range: form.price_range.trim() || null,
          status: form.status.trim() || null,
          is_free: form.is_free,
          hero_image: form.hero_image.trim() || null,
          tags: form.tags,
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

  const importHeroImageFromUrl = async () => {
    if (saving || runningAction || uploadingHeroImage || importingHeroFromUrl || removingHeroImage) return;

    const url = form.hero_image.trim();
    if (!url) {
      setError("Paste an image URL in the Hero image field first.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("Hero image URL must start with http:// or https://.");
      return;
    }

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
      setMessage("Hero image downloaded and saved to storage (external URL was not stored).");
      router.refresh();
    } catch (importUrlError) {
      setError(importUrlError instanceof Error ? importUrlError.message : "Unexpected hero image import error.");
    } finally {
      setImportingHeroFromUrl(false);
    }
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

  return (
    <form onSubmit={onSave} className="space-y-5 pb-20">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Pending Festival Review</h1>
        <p className="mt-1 text-sm text-black/65">ID: {pendingFestival.id}</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
            <h2 className="text-lg font-bold">Core fields</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Title</span>
                <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" required />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Slug</span>
                <input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Category</span>
                <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">City (ID / slug / name / free text)</span>
                <input
                  value={form.city_id}
                  onChange={(e) => {
                    updateField("city_id", e.target.value);
                  }}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2"
                />
                {pendingFestival.city_id === null && normalizeDisplayValue(form.city_id) ? (
                  <p className="mt-2 text-xs text-black/50">Unresolved settlement (free text)</p>
                ) : null}
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Description</span>
                <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <div className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Tags</span>
                <div className="mt-2">
                  <TagsInput value={form.tags} onChange={(tags) => updateField("tags", tags)} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
            <h2 className="text-lg font-bold">Location & dates</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Start date</span>
                <input type="date" value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">End date</span>
                <input type="date" value={form.end_date} onChange={(e) => updateField("end_date", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Venue name</span>
                <input value={form.venue_name} onChange={(e) => updateField("venue_name", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Region</span>
                <input value={form.region} onChange={(e) => updateField("region", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Address</span>
                <input value={form.address} onChange={(e) => updateField("address", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Latitude</span>
                <input value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Longitude</span>
                <input value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
            <h2 className="text-lg font-bold">Organization / media / source</h2>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Organizer name</span>
                <input value={form.organizer_name} onChange={(e) => updateField("organizer_name", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Source URL</span>
                <input value={form.source_url} onChange={(e) => updateField("source_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
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
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Website URL</span>
                <input value={form.website_url} onChange={(e) => updateField("website_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Ticket URL</span>
                <input value={form.ticket_url} onChange={(e) => updateField("ticket_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Price range</span>
                <input value={form.price_range} onChange={(e) => updateField("price_range", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Hero image</span>
                <input value={form.hero_image} onChange={(e) => updateField("hero_image", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
                <div className="mt-3 rounded-xl border border-black/[0.08] bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Manual upload</p>
                  <p className="mt-1 text-xs text-black/65">Use this when extraction picks a weak image. Max file size: 8MB.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="text-xs" />
                    <button
                      type="button"
                      onClick={uploadHeroImage}
                      disabled={saving || Boolean(runningAction) || uploadingHeroImage || importingHeroFromUrl || removingHeroImage}
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {uploadingHeroImage ? "Uploading..." : heroImageUrl ? "Replace image" : "Upload image"}
                    </button>
                    <button
                      type="button"
                      onClick={importHeroImageFromUrl}
                      disabled={saving || Boolean(runningAction) || uploadingHeroImage || importingHeroFromUrl || removingHeroImage || !heroImageUrl}
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {importingHeroFromUrl ? "Importing..." : "Import from URL"}
                    </button>
                    <button
                      type="button"
                      onClick={removeHeroImage}
                      disabled={saving || Boolean(runningAction) || uploadingHeroImage || importingHeroFromUrl || removingHeroImage || !heroImageUrl}
                      className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {removingHeroImage ? "Removing..." : "Remove image"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-black/55">
                    Import from URL downloads the file on the server and uploads it to Supabase; only the storage public URL is stored, not the external link.
                  </p>
                </div>
                <div className="mt-3 rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-xs text-black/65">
                  <p>
                    Selected source: <span className="font-semibold text-black/80">{heroImageSource ?? "—"}</span>
                  </p>
                  <p>
                    Selected score: <span className="font-semibold text-black/80">{heroImageScore ?? "—"}</span>
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
                  <p>
                    Status: <span className="font-semibold text-black/80">{heroImageStatus}</span>
                  </p>
                </div>
                {heroImageUrl ? (
                  <div className="mt-3">
                    <a href={heroImageUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0c0e14] underline underline-offset-2">
                      Open image in new tab
                    </a>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-black/10">
                      {heroPreviewError ? (
                        <p className="p-4 text-sm text-black/60">Image preview unavailable for this URL.</p>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={heroImageUrl}
                          src={heroImageUrl}
                          alt="Hero preview"
                          className="h-auto max-h-[360px] w-full object-cover"
                          onLoad={() => setHeroPreviewError(false)}
                          onError={() => setHeroPreviewError(true)}
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Status</span>
                <input value={form.status} onChange={(e) => updateField("status", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_free} onChange={(e) => updateField("is_free", e.target.checked)} />
                is_free
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 text-sm">
            <h2 className="text-lg font-bold">Secondary moderation metadata</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">ID</span>
                <input value={pendingFestival.id} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Source primary URL</span>
                <input value={form.source_primary_url} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Source count</span>
                <input value={form.source_count} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Source type</span>
                <input value={form.source_type} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Discovered via</span>
                <input value={form.discovered_via} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Verification status</span>
                <input value={form.verification_status} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Verification score</span>
                <input value={form.verification_score} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Duplicate of</span>
                <input value={form.duplicate_of} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Created at</span>
                <input value={form.created_at} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Reviewed at</span>
                <input value={form.reviewed_at} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Reviewed by</span>
                <input value={form.reviewed_by} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
            </div>
          </div>

          <details className="rounded-2xl border border-[#0c0e14]/[0.14] bg-[#f8f9fc] p-5 text-sm">
            <summary className="cursor-pointer text-lg font-bold">Debug / AI / ingestion (collapsed)</summary>
            <p className="mt-1 text-xs text-black/60">Advisory diagnostics and extraction traces. Read-only by default.</p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-black/70 sm:grid-cols-3">
              <p className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5">Version: <span className="font-semibold text-black/80">{pendingFestival.normalization_version ?? "-"}</span></p>
              <p className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5">Applicable: <span className="font-semibold text-black/80">{applicableSuggestionCount}</span></p>
              <p className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5">Safe: <span className="font-semibold text-black/80">{safeSuggestionCount}</span></p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">description_clean</span>
                <textarea value={form.description_clean} readOnly rows={3} className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">description_short</span>
                <textarea value={form.description_short} readOnly rows={3} className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" />
              </label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">category_guess</span><input value={form.category_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">tags_guess</span><input value={form.tags_guess.join(", ")} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">city_guess</span><input value={form.city_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">is_free_guess</span><input value={pendingFestival.is_free_guess === null ? "" : pendingFestival.is_free_guess ? "true" : "false"} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">hero_image_source</span><input value={form.hero_image_source} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">title_clean</span><input value={form.title_clean} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">location_guess</span><input value={form.location_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">date_guess</span><input value={form.date_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">title_guess</span><input value={form.title_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">latitude_guess</span><input value={form.latitude_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">longitude_guess</span><input value={form.longitude_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">address_guess</span><input value={form.address_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">lat_guess</span><input value={form.lat_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">lng_guess</span><input value={form.lng_guess} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">hero_image_original_url</span><input value={form.hero_image_original_url} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">hero_image_score</span><input value={form.hero_image_score} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">normalization_version</span><input value={form.normalization_version} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">extraction_version</span><input value={form.extraction_version} readOnly className="mt-2 w-full rounded-xl border border-black/[0.1] bg-black/[0.03] px-3 py-2" /></label>
            </div>

            <div className="mt-4 space-y-2">
              <details className="rounded-xl border border-black/[0.1] bg-black/[0.02] p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-black/60">deterministic_guess_json</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs text-black/75">{prettyJson(pendingFestival.deterministic_guess_json)}</pre>
              </details>
              <details className="rounded-xl border border-black/[0.1] bg-black/[0.02] p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-black/60">ai_guess_json</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs text-black/75">{prettyJson(pendingFestival.ai_guess_json)}</pre>
              </details>
              <details className="rounded-xl border border-black/[0.1] bg-black/[0.02] p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-black/60">merge_decisions_json</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs text-black/75">{prettyJson(pendingFestival.merge_decisions_json)}</pre>
              </details>
              <details className="rounded-xl border border-black/[0.1] bg-black/[0.02] p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-black/60">evidence_json</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs text-black/75">{prettyJson(pendingFestival.evidence_json)}</pre>
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
                    Apply safe suggestions
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

                <div className="mt-4 space-y-3">
                  {suggestionRows.map(({ suggestion, currentValue, suggestedValue, comparisonStatus, isApplied, canApply }) => {
                    const cardTone = isApplied
                      ? "border-[#18a05e]/30 bg-[#18a05e]/5"
                      : comparisonStatus === "matches"
                        ? "border-black/[0.08] bg-black/[0.03]"
                        : comparisonStatus === "different"
                          ? "border-[#0c0e14]/20 bg-white"
                          : "border-[#b13a1a]/20 bg-[#fff6f3]";

                    return (
                      <div key={suggestion.field} className={`rounded-xl border px-3 py-2.5 ${cardTone}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">{fieldLabel(suggestion.field)}</p>
                            <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/60">
                              {suggestionStateLabel(comparisonStatus, isApplied)}
                            </span>
                            <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/60">
                              Source: {normalizeSourceLabel(suggestion.source)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => applySuggestion(suggestion.field, suggestion.value)}
                            disabled={!canApply}
                            className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {isApplied ? "Applied" : "Apply"}
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

          <div className="rounded-2xl border border-[#0c0e14]/[0.14] bg-[#f8f9fc] p-5 text-sm">
            <h2 className="text-lg font-bold">Pending quality diagnostics</h2>
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
      </section>

      {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-end gap-2 px-4 py-3 md:px-6">
          <Link href="/admin/pending-festivals" className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]">
            Back
          </Link>
          <button
            type="button"
            onClick={() => runDecision("reject")}
            disabled={saving || Boolean(runningAction)}
            className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            {runningAction === "reject" ? "Rejecting..." : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => runDecision("approve")}
            disabled={saving || Boolean(runningAction)}
            className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            {runningAction === "approve" ? "Approving..." : "Approve"}
          </button>
          <button
            type="submit"
            disabled={Boolean(runningAction) || saving}
            className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save edits"}
          </button>
        </div>
      </div>
    </form>
  );
}
