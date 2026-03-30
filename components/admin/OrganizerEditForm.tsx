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
  plan: "free" | "vip" | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  included_promotions_per_year: number | null;
  organizer_rank: number | null;
  claimed_events_count: number | null;
  created_at: string | null;
};

function toDatetimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type OrganizerAiResearchResult = {
  name: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
  source_urls: string[];
  confidence: "low" | "medium" | "high";
  missing_fields: string[];
};

export default function OrganizerEditForm({ organizer }: { organizer: OrganizerRecord }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchSuccess, setResearchSuccess] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState(organizer.name ?? "");
  const [researchResult, setResearchResult] = useState<OrganizerAiResearchResult | null>(null);
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
    plan: organizer.plan === "vip" ? "vip" : "free",
    plan_started_at: toDatetimeLocalValue(organizer.plan_started_at),
    plan_expires_at: toDatetimeLocalValue(organizer.plan_expires_at),
    included_promotions_per_year: organizer.included_promotions_per_year != null ? String(organizer.included_promotions_per_year) : "0",
    organizer_rank: organizer.organizer_rank != null ? String(organizer.organizer_rank) : "0",
  });

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function runOrganizerResearch() {
    const query = researchQuery.trim() || form.name.trim();
    if (!query) {
      setResearchError("Organizer name/query is required.");
      return;
    }

    setResearching(true);
    setResearchError(null);
    setResearchSuccess(null);

    try {
      const response = await fetch("/api/admin/research-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; result?: OrganizerAiResearchResult } | null;
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Organizer AI research failed.");
      }

      setResearchResult(payload.result);
      setResearchSuccess("Organizer AI research completed.");
    } catch (researchRunError) {
      setResearchError(researchRunError instanceof Error ? researchRunError.message : "Unexpected organizer AI research error.");
    } finally {
      setResearching(false);
    }
  }

  function applyResearchValues() {
    if (!researchResult) return;

    setForm((prev) => ({
      ...prev,
      name: researchResult.name ?? prev.name,
      description: researchResult.description ?? prev.description,
      logo_url: researchResult.logo_url ?? prev.logo_url,
      website_url: researchResult.website_url ?? prev.website_url,
      facebook_url: researchResult.facebook_url ?? prev.facebook_url,
      instagram_url: researchResult.instagram_url ?? prev.instagram_url,
      email: researchResult.email ?? prev.email,
      phone: researchResult.phone ?? prev.phone,
    }));

    setResearchSuccess("Extracted values applied to the form. Save organizer to persist.");
    setResearchError(null);
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
          included_promotions_per_year:
            form.included_promotions_per_year.trim() === "" ? null : Number(form.included_promotions_per_year),
          organizer_rank: form.organizer_rank.trim() === "" ? null : Number(form.organizer_rank),
          plan_started_at: form.plan_started_at || null,
          plan_expires_at: form.plan_expires_at || null,
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

  async function onDelete() {
    const confirmed = window.confirm("Delete this organizer? This will remove it from active organizers.");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/admin/api/organizers/${organizer.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete organizer");
      }

      router.push("/admin/organizers");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unexpected error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Edit organizer</h1>
        <p className="mt-1 text-sm text-black/65">Update organizer profile fields used by festivals and follow flows.</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-black/[0.08] bg-[#fafafa] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Organizer AI research</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
            placeholder="Organizer query"
            className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={runOrganizerResearch}
            disabled={researching}
            className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
          >
            {researching ? "Researching..." : "Research with AI"}
          </button>
          <button
            type="button"
            onClick={applyResearchValues}
            disabled={!researchResult || researching}
            className="rounded-xl border border-black/[0.12] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
          >
            Apply extracted values
          </button>
        </div>

        {researchError ? <p className="text-sm text-[#b13a1a]">{researchError}</p> : null}
        {researchSuccess ? <p className="text-sm text-[#1f7a37]">{researchSuccess}</p> : null}

        {researchResult ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-2 md:grid-cols-2">
              <div><span className="text-xs text-black/55">name</span><p className="text-sm">{researchResult.name ?? "—"}</p></div>
              <div><span className="text-xs text-black/55">confidence</span><p className="text-sm">{researchResult.confidence}</p></div>
              <div><span className="text-xs text-black/55">website_url</span><p className="break-all text-sm">{researchResult.website_url ?? "—"}</p></div>
              <div><span className="text-xs text-black/55">facebook_url</span><p className="break-all text-sm">{researchResult.facebook_url ?? "—"}</p></div>
              <div><span className="text-xs text-black/55">instagram_url</span><p className="break-all text-sm">{researchResult.instagram_url ?? "—"}</p></div>
              <div><span className="text-xs text-black/55">email / phone</span><p className="text-sm">{researchResult.email ?? "—"} {researchResult.phone ? `· ${researchResult.phone}` : ""}</p></div>
              <div className="md:col-span-2"><span className="text-xs text-black/55">description</span><p className="text-sm">{researchResult.description ?? "—"}</p></div>
            </div>
            <aside className="space-y-2 rounded-xl border border-black/[0.08] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Sources</p>
              {researchResult.source_urls.length === 0 ? (
                <p className="text-sm text-black/60">No sources returned.</p>
              ) : (
                <div className="space-y-2">
                  {researchResult.source_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all text-sm text-[#0e7a45] hover:underline">
                      {url}
                    </a>
                  ))}
                </div>
              )}
              <p className="pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Missing fields</p>
              <div className="flex flex-wrap gap-2">
                {researchResult.missing_fields.length === 0 ? (
                  <span className="rounded-full border border-black/[0.12] bg-white px-2 py-0.5 text-xs">none</span>
                ) : (
                  researchResult.missing_fields.map((field) => (
                    <span key={field} className="rounded-full border border-black/[0.12] bg-white px-2 py-0.5 text-xs">
                      {field}
                    </span>
                  ))
                )}
              </div>
            </aside>
          </div>
        ) : null}
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
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">plan</span>
          <select value={form.plan} onChange={(e) => updateField("plan", e.target.value as "free" | "vip")} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2">
            <option value="free">free</option>
            <option value="vip">vip</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">plan_started_at</span>
          <input type="datetime-local" value={form.plan_started_at} onChange={(e) => updateField("plan_started_at", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">plan_expires_at</span>
          <input type="datetime-local" value={form.plan_expires_at} onChange={(e) => updateField("plan_expires_at", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">included_promotions_per_year</span>
          <input type="number" value={form.included_promotions_per_year} onChange={(e) => updateField("included_promotions_per_year", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">organizer_rank</span>
          <input type="number" value={form.organizer_rank} onChange={(e) => updateField("organizer_rank", e.target.value)} className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2" />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={form.verified} onChange={(e) => updateField("verified", e.target.checked)} /> verified
        </label>
      </div>

      <div className="text-xs text-black/60">Claimed events: {organizer.claimed_events_count ?? 0} · Created: {organizer.created_at ? new Date(organizer.created_at).toLocaleString() : "-"}</div>

      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="text-sm text-[#1f7a37]">{success}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button disabled={saving || deleting} className="rounded-lg bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
          {saving ? "Saving..." : "Save organizer"}
        </button>
        <button
          type="button"
          disabled={saving || deleting}
          onClick={onDelete}
          className="rounded-lg border border-[#b13a1a]/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b13a1a] hover:bg-[#b13a1a]/5 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete organizer"}
        </button>
      </div>
    </form>
  );
}
