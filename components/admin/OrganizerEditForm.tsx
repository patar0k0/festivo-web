"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type OrganizerRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean | null;
  city_id: number | null;
  claimed_events_count: number | null;
  created_at: string | null;
};

export default function OrganizerEditForm({ organizer }: { organizer: OrganizerRecord }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: organizer.name ?? "",
    slug: organizer.slug ?? "",
    description: organizer.description ?? "",
    logo_url: organizer.logo_url ?? "",
    website_url: organizer.website_url ?? "",
    facebook_url: organizer.facebook_url ?? "",
    instagram_url: organizer.instagram_url ?? "",
    email: organizer.email ?? "",
    phone: organizer.phone ?? "",
    verified: Boolean(organizer.verified),
    city_id: organizer.city_id != null ? String(organizer.city_id) : "",
  });

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/admin/api/organizers/${organizer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          city_id: form.city_id ? Number(form.city_id) : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update organizer");
      }

      setSuccess("Organizer updated.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Edit organizer</h1>
        <p className="mt-1 text-sm text-black/65">Update organizer profile fields used by festivals and follow flows.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">name</span>
          <input value={form.name} onChange={(e) => updateField("name", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">slug</span>
          <input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label className="md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">description</span>
          <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">logo_url</span>
          <input value={form.logo_url} onChange={(e) => updateField("logo_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">website_url</span>
          <input value={form.website_url} onChange={(e) => updateField("website_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">facebook_url</span>
          <input value={form.facebook_url} onChange={(e) => updateField("facebook_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">instagram_url</span>
          <input value={form.instagram_url} onChange={(e) => updateField("instagram_url", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">email</span>
          <input value={form.email} onChange={(e) => updateField("email", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">phone</span>
          <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">city_id</span>
          <input value={form.city_id} onChange={(e) => updateField("city_id", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={form.verified} onChange={(e) => updateField("verified", e.target.checked)} /> verified
        </label>
      </div>

      <div className="text-xs text-black/60">Claimed events: {organizer.claimed_events_count ?? 0} · Created: {organizer.created_at ? new Date(organizer.created_at).toLocaleString() : "-"}</div>

      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="text-sm text-[#1f7a37]">{success}</p> : null}

      <button disabled={saving} className="rounded-lg bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
        {saving ? "Saving..." : "Save organizer"}
      </button>
    </form>
  );
}
