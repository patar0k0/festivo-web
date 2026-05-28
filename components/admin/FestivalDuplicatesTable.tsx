"use client";

import Link from "next/link";
import type { FestivalDuplicateRow } from "@/app/admin/(protected)/festivals/duplicates/page";

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
      {rows.map((row) => {
        const key = `${row.left.id}:${row.right.id}`;
        return (
          <div
            key={key}
            className="rounded-2xl border border-black/[0.08] bg-white/85 p-4"
          >
            {/* Signals */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {row.reasons.map((r) => (
                <span
                  key={r}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SIGNAL_COLORS[r] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {r}
                </span>
              ))}
            </div>

            {/* Festival cards side by side */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FestivalCard fest={row.left} />
              <FestivalCard fest={row.right} />
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">
              <Link
                href={`/admin/festivals/${row.left.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f6f3]"
              >
                Редактирай #1
              </Link>
              <Link
                href={`/admin/festivals/${row.right.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f6f3]"
              >
                Редактирай #2
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
