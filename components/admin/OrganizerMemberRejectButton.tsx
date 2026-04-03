"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OrganizerMemberRejectButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onReject() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/admin/api/organizer-members/${memberId}/reject`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <span className="max-w-xs text-right text-xs text-red-700">{error}</span> : null}
      <button
        type="button"
        onClick={onReject}
        disabled={busy}
        className="inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#8a3b2d] disabled:opacity-45"
      >
        {busy ? "…" : "Отхвърли"}
      </button>
    </div>
  );
}
