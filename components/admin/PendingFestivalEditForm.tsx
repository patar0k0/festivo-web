"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import TagsInput from "@/components/admin/TagsInput";

type PendingFestivalRecord = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  city_id: number | null;
  location_name: string | null;
  address: string | null;
  website_url: string | null;
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

function normalizeCoordinateValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return parsed.toString();
  }

  return null;
}

function findCoordinateGuess(record: PendingFestivalRecord, keys: string[]) {
  for (const key of keys) {
    const value = normalizeCoordinateValue(record[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getComparisonStatus(current: string | null, aiGuess: string | null) {
  if (!aiGuess) {
    return null;
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

  return null;
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
  const titleGuess = normalizeDisplayValue(pendingFestival.title_clean);
  const descriptionShortGuess = normalizeDisplayValue(pendingFestival.description_short);
  const descriptionCleanGuess = normalizeDisplayValue(pendingFestival.description_clean);
  const categoryGuess = normalizeDisplayValue(pendingFestival.category_guess);
  const cityGuess = normalizeDisplayValue(pendingFestival.city_guess);
  const locationGuess = normalizeDisplayValue(pendingFestival.location_guess);
  const dateGuess = normalizeDisplayValue(pendingFestival.date_guess);
  const tagsGuess = normalizeTagsGuess(pendingFestival.tags_guess);
  const tagsCurrent = normalizeTagsGuess(pendingFestival.tags);
  const latitudeGuess = findCoordinateGuess(pendingFestival, ["latitude_guess", "lat_guess", "ai_latitude", "extracted_latitude"]);
  const longitudeGuess = findCoordinateGuess(pendingFestival, ["longitude_guess", "lng_guess", "ai_longitude", "extracted_longitude"]);
  const startDateCurrent = normalizeDisplayValue(asDateInput(pendingFestival.start_date));
  const locationCurrent = normalizeDisplayValue(pendingFestival.location_name);
  const cityDisplayValue =
    normalizeDisplayValue(pendingFestival.city?.name_bg) ??
    normalizeDisplayValue(pendingFestival.city?.slug) ??
    "";
  const titleStatus = getComparisonStatus(normalizeDisplayValue(pendingFestival.title), titleGuess);
  const startDateStatus = getComparisonStatus(startDateCurrent, dateGuess);
  const locationStatus = getComparisonStatus(locationCurrent, locationGuess);
  const freeGuessLabel = pendingFestival.is_free_guess === null ? null : pendingFestival.is_free_guess ? "Free" : "Paid";
  const freeCurrentLabel = pendingFestival.is_free === null ? null : pendingFestival.is_free ? "Free" : "Paid";
  const freeStatus =
    freeGuessLabel === null ? null : freeCurrentLabel === null ? "missing" : freeGuessLabel === freeCurrentLabel ? "matches" : "different";
  const hasAiAssistance =
    Boolean(titleGuess) ||
    Boolean(descriptionShortGuess) ||
    Boolean(descriptionCleanGuess) ||
    Boolean(categoryGuess) ||
    Boolean(cityGuess) ||
    Boolean(locationGuess) ||
    Boolean(dateGuess) ||
    Boolean(freeGuessLabel) ||
    tagsGuess.length > 0 ||
    Boolean(latitudeGuess) ||
    Boolean(longitudeGuess);

  const [form, setForm] = useState({
    title: pendingFestival.title,
    slug: pendingFestival.slug ?? "",
    description: pendingFestival.description ?? "",
    city_id: cityDisplayValue,
    location_name: pendingFestival.location_name ?? "",
    address: pendingFestival.address ?? "",
    latitude: pendingFestival.latitude?.toString() ?? "",
    longitude: pendingFestival.longitude?.toString() ?? "",
    start_date: asDateInput(pendingFestival.start_date),
    end_date: asDateInput(pendingFestival.end_date),
    organizer_name: pendingFestival.organizer_name ?? "",
    source_url: pendingFestival.source_url ?? "",
    website_url: pendingFestival.website_url ?? "",
    is_free: pendingFestival.is_free ?? true,
    hero_image: pendingFestival.hero_image ?? "",
    tags: tagsCurrent,
  });
  const [saving, setSaving] = useState(false);
  const [runningAction, setRunningAction] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [heroPreviewError, setHeroPreviewError] = useState(false);
  const [appliedAiFields, setAppliedAiFields] = useState({
    title: false,
    description: false,
    city_id: false,
    location_name: false,
    start_date: false,
    tags: false,
    latitude: false,
    longitude: false,
  });

  const cityStatus = getComparisonStatus(normalizeDisplayValue(form.city_id), cityGuess);
  const latitudeStatus = getComparisonStatus(normalizeDisplayValue(form.latitude), latitudeGuess);
  const longitudeStatus = getComparisonStatus(normalizeDisplayValue(form.longitude), longitudeGuess);

  const heroImageUrl = form.hero_image.trim();

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    if (key === "hero_image") {
      setHeroPreviewError(false);
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyAiValue = (field: keyof typeof appliedAiFields) => {
    let didApply = false;

    if (field === "title" && titleGuess) {
      updateField("title", titleGuess);
      didApply = true;
    }

    if (field === "description" && descriptionCleanGuess) {
      updateField("description", descriptionCleanGuess);
      didApply = true;
    }

    if (field === "city_id" && cityGuess) {
      updateField("city_id", cityGuess);
      didApply = true;
    }

    if (field === "location_name" && locationGuess) {
      updateField("location_name", locationGuess);
      didApply = true;
    }

    if (field === "start_date" && dateGuess) {
      const normalizedDateGuess = normalizeAiDateGuess(dateGuess);
      if (normalizedDateGuess) {
        updateField("start_date", normalizedDateGuess);
        didApply = true;
      }
    }

    if (field === "tags" && tagsGuess.length > 0) {
      updateField("tags", tagsGuess);
      didApply = true;
    }

    if (field === "latitude" && latitudeGuess) {
      updateField("latitude", latitudeGuess);
      didApply = true;
    }

    if (field === "longitude" && longitudeGuess) {
      updateField("longitude", longitudeGuess);
      didApply = true;
    }

    if (didApply) {
      setAppliedAiFields((prev) => ({ ...prev, [field]: true }));
    }
  };

  const useAllSafeAiValues = () => {
    if (titleGuess && !form.title.trim()) {
      updateField("title", titleGuess);
      setAppliedAiFields((prev) => ({ ...prev, title: true }));
    }

    if (descriptionCleanGuess && !form.description.trim()) {
      updateField("description", descriptionCleanGuess);
      setAppliedAiFields((prev) => ({ ...prev, description: true }));
    }

    if (cityGuess && !form.city_id.trim()) {
      updateField("city_id", cityGuess);
      setAppliedAiFields((prev) => ({ ...prev, city_id: true }));
    }

    if (locationGuess && !form.location_name.trim()) {
      updateField("location_name", locationGuess);
      setAppliedAiFields((prev) => ({ ...prev, location_name: true }));
    }

    if (dateGuess && !form.start_date.trim()) {
      const normalizedDateGuess = normalizeAiDateGuess(dateGuess);
      if (normalizedDateGuess) {
        updateField("start_date", normalizedDateGuess);
        setAppliedAiFields((prev) => ({ ...prev, start_date: true }));
      }
    }

    if (tagsGuess.length > 0 && form.tags.length === 0) {
      updateField("tags", tagsGuess);
      setAppliedAiFields((prev) => ({ ...prev, tags: true }));
    }

    if (latitudeGuess && !form.latitude.trim()) {
      updateField("latitude", latitudeGuess);
      setAppliedAiFields((prev) => ({ ...prev, latitude: true }));
    }

    if (longitudeGuess && !form.longitude.trim()) {
      updateField("longitude", longitudeGuess);
      setAppliedAiFields((prev) => ({ ...prev, longitude: true }));
    }
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
          city: cityInput || null,
          location_name: form.location_name.trim() || null,
          address: form.address.trim() || null,
          latitude: form.latitude.trim() ? Number(form.latitude) : null,
          longitude: form.longitude.trim() ? Number(form.longitude) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          organizer_name: form.organizer_name.trim() || null,
          source_url: form.source_url.trim() || null,
          website_url: form.website_url.trim() || null,
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
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">City / settlement (ID / slug / name / free text)</span>
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
            <h2 className="text-lg font-bold">Dates and location</h2>
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
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Location name</span>
                <input value={form.location_name} onChange={(e) => updateField("location_name", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
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
            <h2 className="text-lg font-bold">Organizer and source</h2>
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
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_free} onChange={(e) => updateField("is_free", e.target.checked)} />
                is_free
              </label>
            </div>
          </div>

          {hasAiAssistance ? (
            <div className="rounded-2xl border border-[#0c0e14]/[0.14] bg-[#f8f9fc] p-5 text-sm">
              <h2 className="text-lg font-bold">AI Assistance</h2>
              <p className="mt-1 text-xs text-black/60">Advisory-only hints from normalization/extraction. Core editable fields remain authoritative.</p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={useAllSafeAiValues}
                  className="rounded-lg border border-black/15 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                >
                  Use all
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {titleGuess ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Clean title · AI guess</p>
                      <button
                        type="button"
                        onClick={() => applyAiValue("title")}
                        className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      >
                        {appliedAiFields.title ? "Applied" : "Use"}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-black/85">{titleGuess}</p>
                    {statusBadgeLabel(titleStatus) ? <p className="mt-1 text-xs text-black/55">Status: {statusBadgeLabel(titleStatus)}</p> : null}
                  </div>
                ) : null}

                {descriptionShortGuess ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Short description · AI guess</p>
                    <p className="mt-1 text-sm text-black/85">{descriptionShortGuess}</p>
                  </div>
                ) : null}

                {descriptionCleanGuess ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Clean description · AI guess</p>
                      <button
                        type="button"
                        onClick={() => applyAiValue("description")}
                        className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      >
                        {appliedAiFields.description ? "Applied" : "Use"}
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-black/85">{descriptionCleanGuess}</p>
                  </div>
                ) : null}

                {categoryGuess ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Category guess</p>
                    <p className="mt-1 text-sm text-black/85">{categoryGuess}</p>
                  </div>
                ) : null}

                {tagsGuess.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Tags guess</p>
                      <button
                        type="button"
                        onClick={() => applyAiValue("tags")}
                        className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      >
                        {appliedAiFields.tags ? "Applied" : "Use AI tags"}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-black/85">Current tags: {form.tags.length > 0 ? form.tags.join(", ") : "-"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tagsGuess.map((tag) => (
                        <span key={tag} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-black/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {cityGuess ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">City · AI guess</p>
                      <button
                        type="button"
                        onClick={() => applyAiValue("city_id")}
                        className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      >
                        {appliedAiFields.city_id ? "Applied" : "Use"}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-black/85">Current value: {normalizeDisplayValue(form.city_id) ?? "-"}</p>
                    <p className="mt-1 text-sm text-black/85">AI guess: {cityGuess}</p>
                    {statusBadgeLabel(cityStatus) ? <p className="mt-1 text-xs text-black/55">Status: {statusBadgeLabel(cityStatus)}</p> : null}
                  </div>
                ) : null}

                {latitudeGuess || longitudeGuess || form.latitude || form.longitude ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Coordinates</p>
                    <p className="mt-1 text-sm text-black/85">Current latitude: {normalizeDisplayValue(form.latitude) ?? "-"}</p>
                    <p className="mt-1 text-sm text-black/85">Current longitude: {normalizeDisplayValue(form.longitude) ?? "-"}</p>

                    {latitudeGuess ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-sm text-black/85">AI/extracted latitude: {latitudeGuess}</p>
                        <button
                          type="button"
                          onClick={() => applyAiValue("latitude")}
                          className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                          disabled={Boolean(normalizeDisplayValue(form.latitude))}
                        >
                          {appliedAiFields.latitude ? "Applied" : "Use"}
                        </button>
                      </div>
                    ) : null}
                    {statusBadgeLabel(latitudeStatus) ? <p className="mt-1 text-xs text-black/55">Latitude status: {statusBadgeLabel(latitudeStatus)}</p> : null}

                    {longitudeGuess ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-sm text-black/85">AI/extracted longitude: {longitudeGuess}</p>
                        <button
                          type="button"
                          onClick={() => applyAiValue("longitude")}
                          className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                          disabled={Boolean(normalizeDisplayValue(form.longitude))}
                        >
                          {appliedAiFields.longitude ? "Applied" : "Use"}
                        </button>
                      </div>
                    ) : null}
                    {statusBadgeLabel(longitudeStatus) ? <p className="mt-1 text-xs text-black/55">Longitude status: {statusBadgeLabel(longitudeStatus)}</p> : null}
                  </div>
                ) : null}

                {locationGuess ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Location · AI guess</p>
                      <button
                        type="button"
                        onClick={() => applyAiValue("location_name")}
                        className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      >
                        {appliedAiFields.location_name ? "Applied" : "Use"}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-black/85">Current value: {locationCurrent ?? "-"}</p>
                    <p className="mt-1 text-sm text-black/85">AI guess: {locationGuess}</p>
                    {statusBadgeLabel(locationStatus) ? <p className="mt-1 text-xs text-black/55">Status: {statusBadgeLabel(locationStatus)}</p> : null}
                  </div>
                ) : null}

                {dateGuess ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Date · AI guess</p>
                      <button
                        type="button"
                        onClick={() => applyAiValue("start_date")}
                        className="rounded-lg border border-black/15 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      >
                        {appliedAiFields.start_date ? "Applied" : "Use"}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-black/85">Current start date: {startDateCurrent ?? "-"}</p>
                    <p className="mt-1 text-sm text-black/85">AI guess: {dateGuess}</p>
                    {statusBadgeLabel(startDateStatus) ? <p className="mt-1 text-xs text-black/55">Status: {statusBadgeLabel(startDateStatus)}</p> : null}
                  </div>
                ) : null}

                {freeGuessLabel ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Free guess</p>
                    <p className="mt-1 text-sm text-black/85">Current value: {freeCurrentLabel ?? "-"}</p>
                    <p className="mt-1 text-sm text-black/85">AI guess: {freeGuessLabel}</p>
                    {statusBadgeLabel(freeStatus) ? <p className="mt-1 text-xs text-black/55">Status: {statusBadgeLabel(freeStatus)}</p> : null}
                  </div>
                ) : null}
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
