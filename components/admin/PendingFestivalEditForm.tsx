"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type PendingFestivalRecord = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  city_id: number | null;
  location_name: string | null;
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
};

type ResolvedCity = {
  id: number;
  name_bg: string;
  slug: string;
};

function asDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
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
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export default function PendingFestivalEditForm({ pendingFestival }: { pendingFestival: PendingFestivalRecord }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: pendingFestival.title,
    slug: pendingFestival.slug ?? "",
    description: pendingFestival.description ?? "",
    city_id: pendingFestival.city_id?.toString() ?? "",
    location_name: pendingFestival.location_name ?? "",
    latitude: pendingFestival.latitude?.toString() ?? "",
    longitude: pendingFestival.longitude?.toString() ?? "",
    start_date: asDateInput(pendingFestival.start_date),
    end_date: asDateInput(pendingFestival.end_date),
    organizer_name: pendingFestival.organizer_name ?? "",
    source_url: pendingFestival.source_url ?? "",
    is_free: pendingFestival.is_free ?? true,
    hero_image: pendingFestival.hero_image ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [runningAction, setRunningAction] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resolvedCity, setResolvedCity] = useState<ResolvedCity | null>(null);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      let cityId: number | null = null;

      if (!cityInput) {
        cityId = null;
        setResolvedCity(null);
      } else if (/^\d+$/.test(cityInput)) {
        cityId = Number(cityInput);
        setResolvedCity(null);
      } else {
        const resolveResponse = await fetch(`/admin/api/cities/resolve?q=${encodeURIComponent(cityInput)}`, {
          credentials: "include",
        });

        if (!resolveResponse.ok) {
          if (resolveResponse.status === 404) {
            throw new Error("City not found");
          }

          throw new Error(await readErrorMessage(resolveResponse, "Failed to resolve city."));
        }

        const resolved = (await resolveResponse.json()) as ResolvedCity;
        cityId = resolved.id;
        setResolvedCity(resolved);
      }

      const response = await fetch(`/admin/api/pending-festivals/${pendingFestival.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim() || null,
          description: form.description.trim() || null,
          city_id: cityId,
          location_name: form.location_name.trim() || null,
          latitude: form.latitude.trim() ? Number(form.latitude) : null,
          longitude: form.longitude.trim() ? Number(form.longitude) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          organizer_name: form.organizer_name.trim() || null,
          source_url: form.source_url.trim() || null,
          is_free: form.is_free,
          hero_image: form.hero_image.trim() || null,
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
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to ${action}.`));
      }

      setMessage(action === "approve" ? "Festival approved and published." : "Festival rejected.");
      router.push("/admin/pending-festivals");
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
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">City (ID / slug / name)</span>
                <input
                  value={form.city_id}
                  onChange={(e) => {
                    updateField("city_id", e.target.value);
                    setResolvedCity(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2"
                />
                {resolvedCity ? <p className="mt-2 text-xs text-black/60">Resolved: {resolvedCity.name_bg} (id={resolvedCity.id}, slug={resolvedCity.slug})</p> : null}
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Description</span>
                <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
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
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Hero image</span>
                <input value={form.hero_image} onChange={(e) => updateField("hero_image", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_free} onChange={(e) => updateField("is_free", e.target.checked)} />
                is_free
              </label>
            </div>
          </div>

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
