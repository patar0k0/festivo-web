"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingFestivalRow = {
  id: string;
  title: string;
  city_id: number | null;
  start_date: string | null;
  end_date: string | null;
  source_url: string | null;
  created_at: string;
};

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export default function PendingFestivalsTable({
  rows,
  initialMessage,
}: {
  rows: PendingFestivalRow[];
  initialMessage?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);

  const runAction = async (id: string, action: "approve" | "reject") => {
    if (busyId) return;

    setBusyId(id);
    setBusyAction(action);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/admin/api/pending-festivals/${id}/${action}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to ${action}.`));
      }

      setMessage(action === "approve" ? "Festival approved and published." : "Festival rejected.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unexpected action error.");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  if (!rows.length) {
    return (
      <div className="space-y-4">
        {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
        {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center text-sm text-black/60">No pending festivals.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
            <tr>
              <th className="px-3 py-3">Title</th>
              <th className="px-3 py-3">City ID</th>
              <th className="px-3 py-3">Start date</th>
              <th className="px-3 py-3">End date</th>
              <th className="px-3 py-3">Source URL</th>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.map((row) => {
              const rowBusy = busyId === row.id;
              return (
                <tr key={row.id} className="hover:bg-black/[0.02]">
                  <td className="px-3 py-3 font-medium text-[#0c0e14]">{row.title}</td>
                  <td className="px-3 py-3 text-black/65">{row.city_id ?? "-"}</td>
                  <td className="px-3 py-3 text-black/65">{row.start_date ?? "-"}</td>
                  <td className="px-3 py-3 text-black/65">{row.end_date ?? "-"}</td>
                  <td className="px-3 py-3 text-black/65">
                    {row.source_url ? (
                      <a href={row.source_url} target="_blank" rel="noreferrer" className="underline decoration-black/25 underline-offset-2">
                        {row.source_url}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-3 text-black/65">{new Date(row.created_at).toLocaleString("bg-BG")}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/pending-festivals/${row.id}`}
                        className="inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
                      >
                        View/Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => runAction(row.id, "approve")}
                        disabled={rowBusy}
                        className="inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {rowBusy && busyAction === "approve" ? "Approving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(row.id, "reject")}
                        disabled={rowBusy}
                        className="inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {rowBusy && busyAction === "reject" ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
