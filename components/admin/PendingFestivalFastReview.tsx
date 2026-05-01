"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FastReviewPendingItem } from "@/lib/admin/pendingFestivalReviewPayload";
import PendingFestivalEvidenceSources from "@/components/admin/PendingFestivalEvidenceSources";

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

type NextPayload = { item: FastReviewPendingItem | null; pending_count: number };

function confidenceBadgeClass(score: number | null) {
  if (score == null) return "border-black/15 bg-black/[0.04] text-black/55";
  if (score >= 70) return "border-[#18a05e]/35 bg-[#18a05e]/10 text-[#0e7a45]";
  if (score >= 40) return "border-[#b8891e]/35 bg-[#fff7e6] text-[#8a6516]";
  return "border-[#b13a1a]/30 bg-[#fff1ec] text-[#9f3115]";
}

function typingTarget(active: Element | null) {
  if (!active) return false;
  const tag = active.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (active instanceof HTMLElement && active.isContentEditable) return true;
  return false;
}

function missingUppercase(m: string): string {
  const map: Record<string, string> = { date: "DATE", city: "CITY", venue: "VENUE" };
  return map[m] ?? m.toUpperCase();
}

async function postSkipTouch(id: string): Promise<void> {
  const res = await fetch("/admin/api/pending-festivals/review/skip", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    console.warn("[fast-review] skip touch failed", await readErrorMessage(res, res.statusText));
  }
}

export default function PendingFestivalFastReview({ initialPendingCount }: { initialPendingCount: number }) {
  const router = useRouter();
  const [current, setCurrent] = useState<FastReviewPendingItem | null | undefined>(undefined);
  const [prefetched, setPrefetched] = useState<FastReviewPendingItem | null>(null);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [navBusy, setNavBusy] = useState(false);
  const prefetching = useRef(false);

  const loadNextRaw = useCallback(async (exclude: string): Promise<NextPayload> => {
    const q = exclude ? `?exclude=${encodeURIComponent(exclude)}` : "";
    const res = await fetch(`/admin/api/pending-festivals/review/next${q}`, { credentials: "include" });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, "Failed to load next festival."));
    }
    return (await res.json()) as NextPayload;
  }, []);

  const recoverFresh = useCallback(async (): Promise<NextPayload> => {
    return loadNextRaw("");
  }, [loadNextRaw]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await loadNextRaw("");
        if (!cancelled) {
          setCurrent(body.item);
          setPendingCount(body.pending_count);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed.");
          setCurrent(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadNextRaw]);

  const runPrefetch = useCallback(
    async (excludeId: string) => {
      if (prefetching.current || !excludeId) return;
      prefetching.current = true;
      try {
        const body = await loadNextRaw(excludeId);
        setPrefetched(body.item);
        setPendingCount(body.pending_count);
      } catch {
        setPrefetched(null);
      } finally {
        prefetching.current = false;
      }
    },
    [loadNextRaw],
  );

  useEffect(() => {
    if (current?.id) {
      setPrefetched(null);
      void runPrefetch(current.id);
    }
  }, [current?.id, runPrefetch]);

  const advance = useCallback(async () => {
    if (!current || navBusy || busy) return;
    setNavBusy(true);
    setError("");
    const curId = current.id;
    try {
      await postSkipTouch(curId);
      const p = prefetched;
      setPrefetched(null);

      if (p && p.id !== curId) {
        setCurrent(p);
      } else {
        try {
          const body = await recoverFresh();
          setCurrent(body.item);
          setPendingCount(body.pending_count);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Advance failed.");
          try {
            const body = await recoverFresh();
            setCurrent(body.item);
            setPendingCount(body.pending_count);
            setError("");
          } catch {
            /* keep error */
          }
        }
      }
    } finally {
      setNavBusy(false);
    }
  }, [busy, current, navBusy, prefetched, recoverFresh]);

  const onApprove = useCallback(async () => {
    if (!current || busy || navBusy) return;
    setBusy("approve");
    setError("");
    const curId = current.id;
    const p = prefetched;
    try {
      const res = await fetch(`/admin/api/pending-festivals/${curId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Approve failed."));
      }
      setPrefetched(null);
      setPendingCount((n) => Math.max(0, n - 1));

      if (p && p.id !== curId) {
        setCurrent(p);
      } else {
        try {
          const body = await recoverFresh();
          setCurrent(body.item);
          setPendingCount(body.pending_count);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Load failed after approve.");
          try {
            const body = await recoverFresh();
            setCurrent(body.item);
            setPendingCount(body.pending_count);
            setError("");
          } catch {
            /* keep error */
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed.");
      setPrefetched(null);
      try {
        const body = await recoverFresh();
        setPendingCount(body.pending_count);
      } catch {
        /* ignore */
      }
      void runPrefetch(curId);
    } finally {
      setBusy(null);
    }
  }, [busy, current, navBusy, prefetched, recoverFresh, runPrefetch]);

  const onReject = useCallback(async () => {
    if (!current || busy || navBusy) return;
    setBusy("reject");
    setError("");
    const curId = current.id;
    const p = prefetched;
    try {
      const res = await fetch(`/admin/api/pending-festivals/${curId}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Reject failed."));
      }
      setPrefetched(null);
      setPendingCount((n) => Math.max(0, n - 1));

      if (p && p.id !== curId) {
        setCurrent(p);
      } else {
        try {
          const body = await recoverFresh();
          setCurrent(body.item);
          setPendingCount(body.pending_count);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Load failed after reject.");
          try {
            const body = await recoverFresh();
            setCurrent(body.item);
            setPendingCount(body.pending_count);
            setError("");
          } catch {
            /* keep error */
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed.");
      setPrefetched(null);
      try {
        const body = await recoverFresh();
        setPendingCount(body.pending_count);
      } catch {
        /* ignore */
      }
      void runPrefetch(curId);
    } finally {
      setBusy(null);
    }
  }, [busy, current, navBusy, prefetched, recoverFresh, runPrefetch]);

  const onEdit = useCallback(() => {
    if (!current) return;
    router.push(`/admin/pending-festivals/${current.id}`);
  }, [current, router]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (typingTarget(document.activeElement)) return;
      if (busy || navBusy) return;
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (k === "a") {
        ev.preventDefault();
        void onApprove();
      } else if (k === "e") {
        ev.preventDefault();
        onEdit();
      } else if (k === "r") {
        ev.preventDefault();
        void onReject();
      } else if (k === "s") {
        ev.preventDefault();
        void advance();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        void advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, busy, navBusy, onApprove, onEdit, onReject]);

  if (current === undefined) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-16 text-center text-sm text-black/55">
        Loading…
      </div>
    );
  }

  if (!current) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <span className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-bold text-[#0c0e14] shadow-sm">
            Pending: {pendingCount}
          </span>
        </div>
        {error ? (
          <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p>
        ) : null}
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-16 text-center text-lg font-semibold text-black/70">
          No pending festivals 🎉
        </div>
        <div className="text-center">
          <Link
            href="/admin/pending-festivals"
            className="text-sm font-semibold text-[#0c0e14] underline decoration-black/25 underline-offset-2"
          >
            Back to table
          </Link>
        </div>
      </div>
    );
  }

  const warnReview = current.needs_review || current.validate_needs_review;
  const missingUpper = current.missing_labels.map(missingUppercase);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-28">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-bold text-[#0c0e14] shadow-sm">
          Pending: {pendingCount}
        </span>
      </div>

      {error ? (
        <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p>
      ) : null}

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h2 className="text-3xl font-black leading-tight tracking-tight text-[#0c0e14] md:text-4xl">
            {current.title}
          </h2>
          <div className="mt-4 space-y-1 text-sm text-black/70">
            <p>
              <span className="font-semibold text-black/55">Date: </span>
              {current.start_date ?? "—"}
              {current.end_date && current.end_date !== current.start_date ? ` – ${current.end_date}` : ""}
            </p>
            <p>
              <span className="font-semibold text-black/55">City: </span>
              {current.city_label || "—"}
            </p>
            <p>
              <span className="font-semibold text-black/55">Venue: </span>
              {current.venue_label || "—"}
            </p>
          </div>
          <div className="mt-5 max-h-[min(28rem,50vh)] overflow-y-auto rounded-xl border border-black/[0.06] bg-black/[0.02] p-4 text-sm leading-relaxed text-black/80">
            {current.description?.trim() ? (
              <p className="whitespace-pre-wrap">{current.description}</p>
            ) : (
              <p className="text-black/45">No description.</p>
            )}
          </div>
          {current.source_url ? (
            <p className="mt-4 text-xs break-all">
              <span className="font-semibold text-black/55">Primary URL: </span>
              <a
                href={current.source_url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-black/25 underline-offset-2"
              >
                {current.source_url}
              </a>
            </p>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)] lg:sticky lg:top-4 lg:self-start">
          {missingUpper.length > 0 ? (
            <div
              className="rounded-xl border-2 border-[#b91c1c] bg-[#fef2f2] px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide text-[#991b1b] shadow-sm"
              role="status"
            >
              <span aria-hidden>❌ </span>
              Missing: {missingUpper.join(", ")}
            </div>
          ) : null}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Confidence</p>
            <span
              className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceBadgeClass(current.confidence_score)}`}
            >
              {current.confidence_score != null ? `${current.confidence_score} / 100` : "—"}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Source count</p>
            <p className="mt-1 text-sm font-medium text-black/75">{current.source_count ?? 0}</p>
          </div>
          {warnReview ? (
            <div className="rounded-lg border border-[#b13a1a]/30 bg-[#fff1ec] px-3 py-2 text-xs font-semibold text-[#9f3115]">
              Needs review
            </div>
          ) : null}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">Evidence</p>
            <div className="mt-2">
              <PendingFestivalEvidenceSources
                evidenceJson={current.evidence_json}
                sourceCount={current.source_count}
                defaultOpen
              />
            </div>
          </div>
          <p className="text-[10px] text-black/40">
            Submitted: {new Date(current.created_at).toLocaleString("bg-BG")}
            {current.submission_source ? ` · ${current.submission_source}` : ""}
          </p>
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-black/[0.08] bg-[#f7f6f3]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || navBusy}
            onClick={() => void onApprove()}
            className="rounded-xl border border-[#18a05e]/40 bg-[#18a05e]/15 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0e7a45] disabled:opacity-45"
          >
            {busy === "approve" ? "Approving…" : "Approve (A)"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || navBusy}
            onClick={onEdit}
            className="rounded-xl border border-black/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black/75 disabled:opacity-45"
          >
            Edit (E)
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || navBusy}
            onClick={() => void onReject()}
            className="rounded-xl border border-[#b13a1a]/35 bg-[#fff1ec] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#9f3115] disabled:opacity-45"
          >
            {busy === "reject" ? "Rejecting…" : "Reject (R)"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || navBusy}
            onClick={() => void advance()}
            className="rounded-xl border border-black/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black/75 disabled:opacity-45"
          >
            {navBusy ? "…" : "Skip (S)"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || navBusy}
            onClick={() => void advance()}
            className="rounded-xl border border-black/20 bg-black/[0.06] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0c0e14] disabled:opacity-45"
          >
            {navBusy ? "…" : "Next → (Enter)"}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-6xl text-center text-[10px] text-black/40">
          Keyboard: A approve · E edit · R reject · S skip · Enter next
        </p>
      </div>
    </div>
  );
}
