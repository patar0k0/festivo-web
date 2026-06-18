"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FestivalDuplicateRow } from "@/lib/admin/festivalDuplicates";

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  published: "bg-blue-100 text-blue-800",
  draft: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "—";
  const color = STATUS_COLORS[label] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function FestivalCard({ fest }: { fest: FestivalDuplicateRow["left"] }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-black/[0.09] bg-[#fafaf8] px-3 py-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/admin/festivals/${fest.id}`}
          className="font-semibold text-[#0c0e14] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {fest.title ?? "(без заглавие)"}
        </Link>
        <StatusBadge status={fest.status} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-black/55">
        {fest.start_date && <span>📅 {fest.start_date}</span>}
        {fest.city_name && <span>📍 {fest.city_name}</span>}
        {fest.slug && (
          <span className="font-mono text-[10px] text-black/40">{fest.slug}</span>
        )}
      </div>
    </div>
  );
}

const SIGNAL_COLORS: Record<string, string> = {
  "еднакво заглавие + дата + град": "bg-red-100 text-red-700",
  "еднакво заглавие + начална дата": "bg-orange-100 text-orange-700",
  "еднакво заглавие + град": "bg-yellow-100 text-yellow-700",
  "еднакво заглавие": "bg-yellow-50 text-yellow-600",
  "еднакъв slug": "bg-purple-100 text-purple-700",
  "близко заглавие": "bg-blue-50 text-blue-600",
};

export default function FestivalDuplicatesTable({ rows }: { rows: FestivalDuplicateRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-8 text-center text-sm text-black/50">
        Не са намерени дублирани фестивали.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <MergePair key={`${row.left.id}:${row.right.id}`} row={row} />
      ))}
    </div>
  );
}

function MergePair({ row }: { row: FestivalDuplicateRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [winnerId, setWinnerId] = useState<string>(suggestWinner(row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loserId = winnerId === row.left.id ? row.right.id : row.left.id;

  async function doMerge() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/festivals/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId, loserId }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Сливането се провали.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мрежова грешка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {row.reasons.map((r) => (
          <span key={r} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SIGNAL_COLORS[r] ?? "bg-gray-100 text-gray-600"}`}>
            {r}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FestivalCard fest={row.left} />
        <FestivalCard fest={row.right} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">
        <Link href={`/admin/festivals/${row.left.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f6f3]">
          Редактирай #1
        </Link>
        <Link href={`/admin/festivals/${row.right.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f6f3]">
          Редактирай #2
        </Link>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-black/[0.12] bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
          Слей
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-black/[0.1] bg-[#fafaf8] p-3 text-sm">
          <p className="mb-2 font-semibold">Кой запис да остане (победител)?</p>
          <div className="flex flex-col gap-1.5">
            {[row.left, row.right].map((f) => (
              <label key={f.id} className="flex items-center gap-2">
                <input type="radio" name={`winner-${row.left.id}-${row.right.id}`} checked={winnerId === f.id} onChange={() => setWinnerId(f.id)} />
                <span>{f.title ?? "(без заглавие)"} <span className="text-black/40">· {f.status ?? "—"}</span></span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-black/55">
            Снимки, програма, организатори и последователи се прехвърлят към избрания.
            Празните му полета се допълват от другия. Другият се архивира (не се трие).
          </p>
          {error && <p className="mt-2 text-[12px] font-medium text-[#b13a1a]">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={doMerge} className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {busy ? "Сливане…" : "Потвърди сливане"}
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold">
              Откажи
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Default winner: verified over non-verified, then earlier start_date. */
function suggestWinner(row: FestivalDuplicateRow): string {
  const score = (s: string | null) => (s === "verified" ? 2 : s === "published" ? 1 : 0);
  const sl = score(row.left.status);
  const sr = score(row.right.status);
  if (sl !== sr) return sl > sr ? row.left.id : row.right.id;
  const dl = row.left.start_date ?? "9999";
  const dr = row.right.start_date ?? "9999";
  return dl <= dr ? row.left.id : row.right.id;
}
