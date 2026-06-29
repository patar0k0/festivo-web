"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProposalStatusResponse = {
  proposal: { id: string; status: string; created_at: string } | null;
  rateLimited: boolean;
  retryAfterSeconds: number;
};

type EnrichResponse =
  | { ok: true; kind: "proposal_created"; proposalId: string; fields: string[] }
  | { ok: true; kind: "nothing_to_patch"; warnings: string[] }
  | { error: string; retryAfterSeconds?: number };

function formatRetryAfter(seconds: number): string {
  const hours = Math.ceil(seconds / 3600);
  return `~${hours}ч`;
}

export default function FestivalSmartEnrichButton({ festivalId }: { festivalId: string }) {
  const [status, setStatus] = useState<ProposalStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/admin/api/festivals/${festivalId}/smart-enrich`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: ProposalStatusResponse) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ proposal: null, rateLimited: false, retryAfterSeconds: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [festivalId]);

  async function runEnrichment() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch(`/admin/api/festivals/${festivalId}/smart-enrich`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as EnrichResponse;
      if (!res.ok || "error" in data) {
        setMessage("error" in data && data.error === "rate_limited" ? "Вече има скорошно търсене за този фестивал." : `Грешка: ${"error" in data ? data.error : "неуспех"}`);
        return;
      }
      if (data.kind === "nothing_to_patch") {
        setMessage("Няма липсващи полета — нищо за предложение.");
        return;
      }
      setStatus({ proposal: { id: data.proposalId, status: "pending", created_at: new Date().toISOString() }, rateLimited: true, retryAfterSeconds: 24 * 3600 });
    } finally {
      setRunning(false);
    }
  }

  if (loadingStatus) return null;

  if (status?.proposal && status.proposal.status === "pending") {
    return (
      <Link
        href={`/admin/enrichment-proposals/${status.proposal.id}`}
        className="inline-flex rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-amber-800 hover:bg-amber-100"
      >
        Чакащо предложение — прегледай
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={runEnrichment}
        disabled={running || Boolean(status?.rateLimited)}
        title={status?.rateLimited ? `Изчакай ${formatRetryAfter(status.retryAfterSeconds)}` : undefined}
        className="inline-flex w-fit rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {running ? "Търсене..." : "Обогати чрез research"}
      </button>
      {message ? <p className="text-xs text-black/55">{message}</p> : null}
    </div>
  );
}
