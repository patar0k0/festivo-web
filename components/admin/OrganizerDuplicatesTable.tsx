"use client";

import { useState } from "react";

type DuplicateRow = {
  left: { id: string; name: string | null; slug: string | null; facebook_url: string | null };
  right: { id: string; name: string | null; slug: string | null; facebook_url: string | null };
  reasons: string[];
};

export default function OrganizerDuplicatesTable({ rows }: { rows: DuplicateRow[] }) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function merge(sourceId: string, targetId: string) {
    const key = `${sourceId}:${targetId}`;
    setLoadingKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/admin/api/organizers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Merge failed");
      }

      setMessage("Merge complete. Reloading...");
      window.location.reload();
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : "Unexpected error");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-5">
      <h1 className="text-2xl font-black tracking-tight">Organizer duplicates</h1>
      <p className="text-sm text-black/65">Conservative matches only. Manual merge is required for every action.</p>

      {message ? <p className="text-sm text-[#1f7a37]">{message}</p> : null}
      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-xl bg-black/[0.03] p-4 text-sm text-black/65">No likely duplicates found.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/[0.08]">
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
              <tr>
                <th className="px-3 py-2">Left organizer</th>
                <th className="px-3 py-2">Right organizer</th>
                <th className="px-3 py-2">Match reasons</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const leftToRightKey = `${row.left.id}:${row.right.id}`;
                const rightToLeftKey = `${row.right.id}:${row.left.id}`;
                return (
                  <tr key={`${row.left.id}:${row.right.id}`} className="border-t border-black/[0.08] align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold">{row.left.name || "(no name)"}</div>
                      <div className="text-xs text-black/60">slug: {row.left.slug || "-"}</div>
                      <div className="text-xs text-black/60">facebook: {row.left.facebook_url || "-"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{row.right.name || "(no name)"}</div>
                      <div className="text-xs text-black/60">slug: {row.right.slug || "-"}</div>
                      <div className="text-xs text-black/60">facebook: {row.right.facebook_url || "-"}</div>
                    </td>
                    <td className="px-3 py-3 text-black/70">{row.reasons.join(", ")}</td>
                    <td className="space-y-2 px-3 py-3">
                      <button
                        disabled={loadingKey !== null}
                        onClick={() => merge(row.left.id, row.right.id)}
                        className="block w-full rounded-lg bg-[#0c0e14] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                      >
                        {loadingKey === leftToRightKey ? "Merging..." : "Merge left → right"}
                      </button>
                      <button
                        disabled={loadingKey !== null}
                        onClick={() => merge(row.right.id, row.left.id)}
                        className="block w-full rounded-lg border border-black/[0.15] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                      >
                        {loadingKey === rightToLeftKey ? "Merging..." : "Merge right → left"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
