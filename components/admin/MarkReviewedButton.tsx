"use client";

import { useState } from "react";

type Props = {
  reportId: string;
};

export function MarkReviewedButton({ reportId }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-xs text-emerald-700">✓ Разгледан</span>;
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/admin/api/festival-reports/${reportId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewed: true }),
          });
          setDone(true);
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md border border-black/[0.12] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-50"
    >
      {busy ? "..." : "Маркирай разгледан"}
    </button>
  );
}
