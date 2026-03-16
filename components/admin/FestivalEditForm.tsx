"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TagsInput from "@/components/admin/TagsInput";

type FestivalRecord = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  city: string | null;
  city_id: number | null;
  city_name?: string | null;
  city_slug?: string | null;
  region: string | null;
  location_name: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  hero_image?: string | null;
  website_url: string | null;
  ticket_url: string | null;
  price_range: string | null;
  lat: number | null;
  lng: number | null;
  is_free: boolean | null;
  is_verified: boolean | null;
  status: "draft" | "verified" | "rejected" | "archived" | "published";
  tags: string[] | null;
  description: string | null;
  source_url: string | null;
  source_type: string | null;
  organizer_name?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

const STATUS_OPTIONS = ["draft", "verified", "published", "rejected", "archived"] as const;

const SECONDARY_METADATA_FIELDS = [
  "id",
  "source_primary_url",
  "source_count",
  "source_type",
  "discovered_via",
  "verification_status",
  "verification_score",
  "duplicate_of",
  "created_at",
  "updated_at",
  "reviewed_at",
  "reviewed_by",
] as const;

const DEBUG_KEYWORDS = [
  "evidence_json",
  "deterministic_guess_json",
  "ai_guess_json",
  "merge_decisions_json",
  "normalization_version",
  "extraction_version",
  "hero_image_original_url",
  "hero_image_score",
];

function asDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function validateCoords(latRaw: string, lngRaw: string) {
  if (!latRaw && !lngRaw) {
    return { valid: true, message: "Координатите са празни (допустимо)." };
  }

  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valid: false, message: "Координатите трябва да са числа." };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, message: "Координатите са извън валиден диапазон." };
  }

  return { valid: true, message: "Координатите са валидни." };
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

function valueLabel(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

type SaveFestivalResponse = {
  city_created?: boolean;
  city?: {
    id?: number | null;
    name_bg?: string | null;
    slug?: string | null;
  };
  displayed_city?: string | null;
};

export default function FestivalEditForm({ festival }: { festival: FestivalRecord }) {
  const initialCityDisplay = festival.city_name ?? festival.city ?? "";

  const [form, setForm] = useState({
    title: festival.title,
    slug: festival.slug,
    category: festival.category ?? "",
    city: initialCityDisplay,
    city_id: festival.city_id?.toString() ?? "",
    location_name: festival.location_name ?? "",
    region: festival.region ?? "",
    address: festival.address ?? "",
    start_date: asDateInput(festival.start_date),
    end_date: asDateInput(festival.end_date),
    hero_image: festival.hero_image ?? festival.image_url ?? "",
    website_url: festival.website_url ?? "",
    ticket_url: festival.ticket_url ?? "",
    organizer_name: typeof festival.organizer_name === "string" ? festival.organizer_name : "",
    source_url: festival.source_url ?? "",
    price_range: festival.price_range ?? "",
    latitude: festival.lat?.toString() ?? "",
    longitude: festival.lng?.toString() ?? "",
    is_free: festival.is_free ?? false,
    is_verified: festival.is_verified ?? false,
    status: festival.status,
    tags: festival.tags ?? [],
    description: festival.description ?? "",
  });

  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<"archive" | "restore" | "delete" | null>(null);
  const router = useRouter();

  const descriptionPreview = useMemo(() => form.description.trim(), [form.description]);

  const debugEntries = useMemo(() => {
    const keys = Object.keys(festival).filter((key) => {
      const lower = key.toLowerCase();
      if (SECONDARY_METADATA_FIELDS.includes(key as (typeof SECONDARY_METADATA_FIELDS)[number])) return false;
      if (DEBUG_KEYWORDS.some((token) => lower.includes(token))) return true;
      return lower.includes("_guess") || lower.endsWith("_json");
    });

    return keys.sort().map((key) => [key, festival[key]] as const);
  }, [festival]);

  const secondaryMetadata = useMemo(() => {
    return SECONDARY_METADATA_FIELDS
      .filter((key) => key in festival)
      .map((key) => ({ key, value: festival[key] }));
  }, [festival]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onValidateCoords = () => {
    const validation = validateCoords(form.latitude, form.longitude);
    if (validation.valid) {
      setError("");
      setMessage(validation.message);
      return;
    }

    setMessage("");
    setError(validation.message);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const validation = validateCoords(form.latitude, form.longitude);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setSaving(true);

    try {
      const cityInput = form.city.trim();
      const trimmedCityId = form.city_id.trim();
      const cityId = trimmedCityId ? Number(trimmedCityId) : null;

      if (trimmedCityId) {
        const parsedCityId = Number(trimmedCityId);
        if (!Number.isInteger(parsedCityId) || parsedCityId <= 0) {
          throw new Error("city_id трябва да е положително цяло число.");
        }
      }

      const response = await fetch(`/admin/api/festivals/${festival.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          description: form.description || null,
          city_id: cityId,
          city_name_display: cityInput || null,
          location_name: form.location_name || null,
          venue_name: form.location_name || null,
          region: form.region || null,
          address: form.address || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          organizer_name: form.organizer_name || null,
          source_url: form.source_url || null,
          website_url: form.website_url || null,
          ticket_url: form.ticket_url || null,
          is_free: form.is_free,
          price_range: form.price_range || null,
          hero_image: form.hero_image || null,
          tags: form.tags,
          category: form.category || null,
          status: form.status,
          is_verified: form.is_verified,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешен запис."));
      }

      const payload = (await response.json().catch(() => null)) as SaveFestivalResponse | null;
      const resolvedCityDisplay = payload?.city?.name_bg ?? payload?.displayed_city ?? payload?.city?.slug ?? cityInput;

      if (resolvedCityDisplay) {
        updateField("city", resolvedCityDisplay);
      }
      if (payload?.city?.id) {
        updateField("city_id", String(payload.city.id));
      }

      setMessage("Промените са записани успешно.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Възникна грешка.");
    } finally {
      setSaving(false);
    }
  };

  const runArchiveAction = async (action: "archive" | "restore") => {
    if (saving || actionPending) return;

    setMessage("");
    setError("");
    setActionPending(action);

    try {
      const response = await fetch(`/admin/api/festivals/${festival.id}/archive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно обновяване на статуса."));
      }

      updateField("status", action === "archive" ? "archived" : "verified");
      setMessage(action === "archive" ? "Фестивалът е архивиран." : "Фестивалът е възстановен.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Възникна грешка.");
    } finally {
      setActionPending(null);
    }
  };

  const runDeleteAction = async () => {
    if (saving || actionPending) return;

    const confirmed = window.confirm("Сигурни ли сте, че искате да изтриете този фестивал? Това действие е необратимо.");
    if (!confirmed) return;

    setMessage("");
    setError("");
    setActionPending("delete");

    try {
      const response = await fetch(`/admin/api/festivals/${festival.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно изтриване."));
      }

      router.push("/admin/festivals?deleted=1");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Възникна грешка.");
    } finally {
      setActionPending(null);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-20">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Редакция на фестивал</h1>
        <p className="mt-1 text-xs text-black/55">State: {form.status === "archived" ? "Archived" : "Active"}</p>
      </div>

      <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h2 className="text-lg font-bold">Основни данни (editable)</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">title</span>
            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" required />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">slug</span>
            <input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">category</span>
            <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">city_id</span>
            <input value={form.city_id} onChange={(e) => updateField("city_id", e.target.value)} placeholder="напр. 68134" className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">city (display / fallback)</span>
            <input
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="напр. Пловдив"
              className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">location_name / venue_name</span>
            <input value={form.location_name} onChange={(e) => updateField("location_name", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">region</span>
            <input value={form.region} onChange={(e) => updateField("region", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">address</span>
            <input value={form.address} onChange={(e) => updateField("address", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">latitude</span>
            <input value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">longitude</span>
            <input value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">start_date</span>
            <input type="date" value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">end_date</span>
            <input type="date" value={form.end_date} onChange={(e) => updateField("end_date", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">organizer_name</span>
            <input value={form.organizer_name} onChange={(e) => updateField("organizer_name", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">source_url</span>
            <input value={form.source_url} onChange={(e) => updateField("source_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">website_url</span>
            <input value={form.website_url} onChange={(e) => updateField("website_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">ticket_url</span>
            <input value={form.ticket_url} onChange={(e) => updateField("ticket_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">price_range</span>
            <input value={form.price_range} onChange={(e) => updateField("price_range", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">hero_image</span>
            <input value={form.hero_image} onChange={(e) => updateField("hero_image", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input type="checkbox" checked={form.is_free} onChange={(e) => updateField("is_free", e.target.checked)} />
            is_free
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">status</span>
            <select value={form.status} onChange={(e) => updateField("status", e.target.value as (typeof STATUS_OPTIONS)[number])} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2">
              {STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">tags</span>
            <div className="mt-2">
              <TagsInput value={form.tags} onChange={(tags) => updateField("tags", tags)} />
            </div>
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">description</span>
            <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={6} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
          </label>
        </div>
        <button type="button" onClick={onValidateCoords} className="mt-3 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
          Validate coords
        </button>
        <div className="mt-3 rounded-xl border border-black/[0.08] bg-white/80 p-3 text-sm text-black/70">
          {descriptionPreview || "Няма описание за preview."}
        </div>
      </section>

      {secondaryMetadata.length ? (
        <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 text-sm">
          <h2 className="text-lg font-bold">Вторични метаданни (read-only)</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {secondaryMetadata.map(({ key, value }) => (
              <p key={key} className="text-black/70">
                <span className="font-semibold">{key}:</span> {valueLabel(value)}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {debugEntries.length ? (
        <details className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.14em] text-black/60">Debug / technical fields</summary>
          <div className="mt-4 space-y-3">
            {debugEntries.map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">{key}</p>
                <pre className="mt-2 overflow-x-auto rounded-xl border border-black/[0.08] bg-black/[0.02] p-3 text-xs text-black/80">{prettyJson(value)}</pre>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-end gap-2 px-4 py-3 md:px-6">
          <label className="mr-auto flex items-center gap-2 text-sm text-black/60">
            <input type="checkbox" checked={form.is_verified} onChange={(e) => updateField("is_verified", e.target.checked)} />
            is_verified (legacy)
          </label>
          <Link href="/admin/festivals" className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]">
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => runArchiveAction(form.status === "archived" ? "restore" : "archive")}
            disabled={saving || Boolean(actionPending)}
            className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            {actionPending === "archive" || actionPending === "restore"
              ? "Working..."
              : form.status === "archived"
                ? "Restore"
                : "Archive"}
          </button>
          <button
            type="button"
            onClick={runDeleteAction}
            disabled={saving || Boolean(actionPending)}
            className="rounded-xl border border-[#b13a1a]/30 bg-[#ff4c1f]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#b13a1a] disabled:opacity-50"
          >
            {actionPending === "delete" ? "Deleting..." : "Delete"}
          </button>
          <button
            type="submit"
            disabled={saving || Boolean(actionPending)}
            className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
