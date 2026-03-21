"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

type CreateOrganizerResponse = {
  row?: {
    id: string;
    name: string;
    slug: string;
  };
  error?: string;
};

export default function OrganizerResearchCreatePanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<OrganizerAiResearchResult | null>(null);
  const [researching, setResearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function runResearch() {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setError("Organizer query is required.");
      return;
    }

    setResearching(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/research-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; result?: OrganizerAiResearchResult } | null;
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Organizer AI research failed.");
      }

      setResult(payload.result);
      setSuccess("Organizer AI research completed. Review and create organizer if valid.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unexpected organizer research error.");
    } finally {
      setResearching(false);
    }
  }

  async function createOrganizerFromResult() {
    if (!result?.name) {
      setError("Missing organizer name in extracted result.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/admin/api/organizers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name,
          description: result.description,
          logo_url: result.logo_url,
          website_url: result.website_url,
          facebook_url: result.facebook_url,
          instagram_url: result.instagram_url,
        }),
      });

      const payload = (await response.json().catch(() => null)) as CreateOrganizerResponse | null;
      if (!response.ok || !payload?.row?.id) {
        throw new Error(payload?.error ?? "Failed to create organizer from AI result.");
      }

      setSuccess(`Organizer created: ${payload.row.name}`);
      router.push(`/admin/organizers/${payload.row.id}/edit`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unexpected organizer create error.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Research organizer</h1>
        <p className="mt-1 text-sm text-black/65">Search and create new organizer profiles that are not yet in the list.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="НЧ „Светлина“ Голямо Враново"
          className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={runResearch}
          disabled={researching}
          className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
        >
          {researching ? "Researching..." : "Research with AI"}
        </button>
      </div>

      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="text-sm text-[#1f7a37]">{success}</p> : null}

      {result ? (
        <div className="space-y-4 rounded-xl border border-black/[0.08] bg-[#fafafa] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">name</span>
              <input value={result.name ?? ""} readOnly className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">confidence</span>
              <input value={result.confidence} readOnly className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">website_url</span>
              <input value={result.website_url ?? ""} readOnly className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">facebook_url</span>
              <input value={result.facebook_url ?? ""} readOnly className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">instagram_url</span>
              <input value={result.instagram_url ?? ""} readOnly className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">logo_url</span>
              <input value={result.logo_url ?? ""} readOnly className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm" />
            </label>
            <label className="md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">description</span>
              <textarea value={result.description ?? ""} readOnly rows={4} className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm" />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Sources</p>
            {result.source_urls.length === 0 ? (
              <p className="text-sm text-black/60">No sources returned.</p>
            ) : (
              <div className="space-y-1">
                {result.source_urls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all text-sm text-[#0e7a45] hover:underline">
                    {url}
                  </a>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={createOrganizerFromResult}
            disabled={!result.name || creating}
            className="rounded-xl border border-black/[0.12] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create organizer from result"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
