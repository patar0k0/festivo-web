"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EnrichmentProposalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(action: "approve" | "reject") {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/admin/api/enrichment-proposals/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Неуспех.");
      router.push("/admin/enrichment-proposals");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => submit("approve")}
          disabled={busy}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45"
        >
          {busy ? "…" : "✅ Одобри и приложи"}
        </button>
        <button
          type="button"
          onClick={() => submit("reject")}
          disabled={busy}
          className="rounded-xl border border-black/[0.12] bg-white px-5 py-2.5 text-sm font-semibold hover:bg-black/[0.03] disabled:opacity-45"
        >
          {busy ? "…" : "❌ Отхвърли"}
        </button>
      </div>
    </div>
  );
}
