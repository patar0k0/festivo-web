"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import TagsInput from "@/components/admin/TagsInput";
import { extractNormalizationSuggestions, type SuggestionField } from "@/lib/festival/normalizationSuggestions";

type PendingFestivalRecord = {
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

function getComparisonStatus(current: string | null, aiGuess: string | null) {
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

function statusBadgeLabel(status: ReturnType<typeof getComparisonStatus>) {
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



export default function PendingFestivalEditForm({ pendingFestival }: { pendingFestival: PendingFestivalRecord }) {
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
    category: (typeof pendingFestival.category === "string" ? pendingFestival.category : "") ?? "",
    city_id: cityDisplayValue,
    region: (typeof pendingFestival.region === "string" ? pendingFestival.region : "") ?? "",
    venue_name: pendingFestival.location_name ?? "",
    address: pendingFestival.address ?? "",
    latitude: pendingFestival.latitude?.toString() ?? "",
    longitude: pendingFestival.longitude?.toString() ?? "",
    start_date: asDateInput(pendingFestival.start_date),
    end_date: asDateInput(pendingFestival.end_date),
    organizer_name: pendingFestival.organizer_name ?? "",
    source_url: pendingFestival.source_url ?? "",
    website_url: pendingFestival.website_url ?? "",
    ticket_url: (typeof pendingFestival.ticket_url === "string" ? pendingFestival.ticket_url : "") ?? "",
    price_range: (typeof pendingFestival.price_range === "string" ? pendingFestival.price_range : "") ?? "",
    is_free: pendingFestival.is_free ?? true,
    hero_image: pendingFestival.hero_image ?? "",
    tags: tagsCurrent,
  });
  const [saving, setSaving] = useState(false);
  const [runningAction, setRunningAction] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [safeApplySummary, setSafeApplySummary] = useState<{ applied: number; skipped: string[] } | null>(null);
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
    const safeFields: SuggestionField[] = ["category", "tags", "venue_name", "region"];
    let applied = 0;
    const skipped: string[] = [];

    for (const field of safeFields) {
      const suggestion = normalizationSuggestions.find((entry) => entry.field === field);
      if (!suggestion) {
        skipped.push(`${fieldLabel(field)} (no suggestion)`);
        continue;
      }

      const currentValue = getCurrentValue(field);
      const suggestionValue = Array.isArray(suggestion.value) ? suggestion.value.join(", ") : suggestion.value;
      const normalizedSuggested = normalizeDisplayValue(suggestionValue);
      const comparisonStatus = getComparisonStatus(currentValue, normalizedSuggested);
      const canApply = comparisonStatus !== "matches" && comparisonStatus !== "empty";

      if (!canApply) {
        skipped.push(`${fieldLabel(field)} (${comparisonStatus === "matches" ? "unchanged" : "empty suggestion"})`);
        continue;
      }

      const didApply = applySuggestion(field, suggestion.value);
      if (didApply) {
        applied += 1;
      } else {
        skipped.push(`${fieldLabel(field)} (invalid suggestion value)`);
      }
    }

    setSafeApplySummary({ applied, skipped });
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
              <div className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-xs text-black/60">Source type: {pendingFestival.source_type ?? "-"} · Status: {pendingFestival.status}</div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_free} onChange={(e) => updateField("is_free", e.target.checked)} />
                is_free
              </label>
            </div>
          </div>

          {hasNormalizeSuggestions ? (
            <div className="rounded-2xl border border-[#0c0e14]/[0.14] bg-[#f8f9fc] p-5 text-sm">
              <h2 className="text-lg font-bold">AI Normalize Suggestions</h2>
              <p className="mt-1 text-xs text-black/60">Suggestions are advisory only. Apply actions only update the local form until you click Save edits.</p>
              <p className="mt-1 text-xs text-black/60">Normalization version: {pendingFestival.normalization_version ?? "-"}</p>
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
                    <p>Applied fields: {safeApplySummary.applied}</p>
                    {safeApplySummary.skipped.length > 0 ? <p>Skipped: {safeApplySummary.skipped.join("; ")}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {normalizationSuggestions.map((suggestion) => {
                  const currentValue = getCurrentValue(suggestion.field);
                  const suggestedValue = Array.isArray(suggestion.value) ? suggestion.value.join(", ") : suggestion.value;
                  const comparisonStatus = getComparisonStatus(currentValue, normalizeDisplayValue(suggestedValue));
                  const isApplied = appliedAiFields[suggestion.field];
                  const canApply = comparisonStatus !== "matches" && comparisonStatus !== "empty";
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
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">{fieldLabel(suggestion.field)} · Source: {normalizeSourceLabel(suggestion.source)}</p>
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
            </div>
          ) : null}

          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 text-sm">
            <h2 className="text-lg font-bold">Moderation state</h2>
            <p className="mt-2 text-black/65">Status: {pendingFestival.status}</p>
            <p className="mt-1 text-black/65">Created: {new Date(pendingFestival.created_at).toLocaleString("bg-BG")}</p>
            <p className="mt-1 text-black/65">Reviewed at: {pendingFestival.reviewed_at ? new Date(pendingFestival.reviewed_at).toLocaleString("bg-BG") : "-"}</p>
            <p className="mt-1 text-black/65">Reviewed by: {pendingFestival.reviewed_by ?? "-"}</p>
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
