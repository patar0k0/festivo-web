"use client";

import { useState } from "react";

export default function OrganizerClaimActions({ memberId }: { memberId: string }) {
  const [loading, setLoading] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState("");

  async function handleApprove() {
    if (loading) return;
    setLoading("approve");
    setError("");
    try {
      const res = await fetch(`/admin/api/organizer-members/${memberId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    if (loading) return;
    if (!confirm("Сигурен ли си, че искаш да отхвърлиш заявката?")) return;
    setLoading("reject");
    setError("");
    try {
      const res = await fetch(`/admin/api/organizer-members/${memberId}/reject`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-black/[0.06] pt-6">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={!!loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading === "approve" ? "Одобряване..." : "Одобри"}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={!!loading}
          className="rounded border border-red-500 px-4 py-2 text-red-600 disabled:opacity-50"
        >
          {loading === "reject" ? "Отхвърляне..." : "Отхвърли"}
        </button>
      </div>
    </div>
  );
}
