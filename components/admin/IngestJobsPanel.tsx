"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type IngestJobRow = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  source_url: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
};

function isValidFacebookEventUrl(input: string) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname.toLowerCase().includes("facebook.com") && url.pathname.toLowerCase().includes("/events/");
  } catch {
    return false;
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export default function IngestJobsPanel({ rows }: { rows: IngestJobRow[] }) {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!isValidFacebookEventUrl(sourceUrl)) {
      setError("Please enter a valid Facebook event URL (facebook.com/events/...).");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/admin/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source_url: sourceUrl }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to enqueue URL."));
      }

      const payload = (await response.json()) as { ok: true; id: string };
      setMessage(`Queued successfully. Job ID: ${payload.id}`);
      setSourceUrl("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected queue error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h2 className="text-lg font-bold">Queue Facebook event</h2>
        <p className="mt-1 text-sm text-black/65">Paste a Facebook event URL to enqueue it for worker ingestion.</p>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Facebook event URL
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://www.facebook.com/events/..."
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Adding..." : "Add to queue"}
          </button>
        </form>

        {message ? <p className="mt-3 rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
        {error ? <p className="mt-3 rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
            <tr>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Source URL</th>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Started</th>
              <th className="px-3 py-3">Finished</th>
              <th className="px-3 py-3">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-black/[0.02]">
                  <td className="px-3 py-3 text-black/75">{row.status}</td>
                  <td className="px-3 py-3 text-black/75">
                    <a href={row.source_url} target="_blank" rel="noreferrer" className="break-all underline decoration-black/25 underline-offset-2">
                      {row.source_url}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-black/65">{new Date(row.created_at).toLocaleString("bg-BG")}</td>
                  <td className="px-3 py-3 text-black/65">{row.started_at ? new Date(row.started_at).toLocaleString("bg-BG") : "-"}</td>
                  <td className="px-3 py-3 text-black/65">{row.finished_at ? new Date(row.finished_at).toLocaleString("bg-BG") : "-"}</td>
                  <td className="px-3 py-3 text-[#b13a1a]">{row.error ?? "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-black/60">
                  No jobs queued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
