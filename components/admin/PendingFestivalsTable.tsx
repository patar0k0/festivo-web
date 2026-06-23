"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PendingQualityBucket } from "@/lib/admin/pendingFestivalQuality";
import { listEvidenceSources } from "@/lib/admin/pendingEvidenceSources";

type PendingFestivalRow = {
  id: string;
  title: string;
  city_id: number | null;
  city_guess: string | null;
  organizer_name: string | null;
  start_date: string | null;
  end_date: string | null;
  source_url: string | null;
  source_count: number | null;
  evidence_json: unknown;
  submission_source: string | null;
  created_at: string;
  quality_score: number;
  quality_bucket: PendingQualityBucket;
  missing_fields: string[];
};

const FIELD_LABELS: Record<string, string> = {
  title: "заглавие",
  start_date: "начална дата",
  end_date: "крайна дата",
  city: "град",
  city_id: "град",
  coordinates: "координати",
  organizer_name: "организатор",
  hero_image: "снимка",
  description: "описание",
  location_name: "място",
  address: "адрес",
  category: "категория",
  tags: "тагове",
  source_url: "уебсайт",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function domainFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "…" : url;
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

function bucketStyle(bucket: PendingQualityBucket) {
  if (bucket === "ready") return "border-[#18a05e]/30 bg-[#18a05e]/10 text-[#0e7a45]";
  if (bucket === "needs_fix") return "border-[#b8891e]/30 bg-[#fff7e6] text-[#8a6516]";
  return "border-[#b13a1a]/30 bg-[#fff1ec] text-[#9f3115]";
}

function bucketLabel(bucket: PendingQualityBucket) {
  if (bucket === "ready") return "Готов";
  if (bucket === "needs_fix") return "Нужни корекции";
  return "Слаб";
}

export default function PendingFestivalsTable({
  rows,
  initialMessage,
  qualityFilter,
  qualityCounts,
}: {
  rows: PendingFestivalRow[];
  initialMessage?: string;
  qualityFilter?: PendingQualityBucket | "";
  qualityCounts: Record<PendingQualityBucket, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState<Record<string, boolean>>({});

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
        throw new Error(await readErrorMessage(response, `Неуспешно ${action === "approve" ? "одобрение" : "отхвърляне"}.`));
      }
      setMessage(action === "approve" ? "Фестивалът е одобрен и публикуван." : "Фестивалът е отхвърлен.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Неочаквана грешка.");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const setFilter = (bucket: PendingQualityBucket | "") => {
    const next = new URLSearchParams(searchParams.toString());
    if (!bucket) {
      next.delete("quality");
    } else {
      next.set("quality", bucket);
    }
    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  };

  if (!rows.length) {
    return (
      <div className="space-y-4">
        {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
        {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center text-sm text-black/60">
          {qualityFilter ? "Няма чакащи фестивали в тази категория." : "Няма чакащи фестивали."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

      {/* Quality filter tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/[0.08] bg-white/85 p-3 text-xs">
        {(
          [
            { key: "" as const, label: "Всички" },
            { key: "ready" as const, label: `Готови (${qualityCounts.ready})` },
            { key: "needs_fix" as const, label: `Нужни корекции (${qualityCounts.needs_fix})` },
            { key: "weak" as const, label: `Слаби (${qualityCounts.weak})` },
          ] as { key: PendingQualityBucket | ""; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg border px-2.5 py-1 font-semibold uppercase tracking-[0.12em] transition ${
              qualityFilter === key
                ? key === "ready"
                  ? "border-[#18a05e]/40 bg-[#18a05e]/10 text-[#0e7a45]"
                  : key === "needs_fix"
                    ? "border-[#b8891e]/40 bg-[#fff7e6] text-[#8a6516]"
                    : key === "weak"
                      ? "border-[#b13a1a]/40 bg-[#fff1ec] text-[#9f3115]"
                      : "border-black/20 bg-black/[0.05]"
                : "border-black/[0.1] bg-white hover:bg-black/[0.03]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
            <tr>
              <th className="px-3 py-3">Заглавие</th>
              <th className="px-3 py-3">Качество</th>
              <th className="px-3 py-3">Град</th>
              <th className="px-3 py-3">Организатор</th>
              <th className="px-3 py-3">Дати</th>
              <th className="px-3 py-3">Източник</th>
              <th className="px-3 py-3">Тип</th>
              <th className="px-3 py-3">Създаден</th>
              <th className="px-3 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.map((row) => {
              const rowBusy = busyId === row.id;
              const evidenceSources = listEvidenceSources(row.evidence_json);
              const showList = Boolean(sourcesOpen[row.id]);

              const cityDisplay = row.city_guess?.trim() || (row.city_id ? `#${row.city_id}` : "—");

              return (
                <tr key={row.id} className="hover:bg-black/[0.02]">
                  {/* Title */}
                  <td className="max-w-[16rem] px-3 py-3 font-medium text-[#0c0e14]">
                    <Link href={`/admin/pending-festivals/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                  </td>

                  {/* Quality */}
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${bucketStyle(row.quality_bucket)}`}>
                        {bucketLabel(row.quality_bucket)} · {row.quality_score}
                      </span>
                      {row.missing_fields.length > 0 ? (
                        <p className="text-xs text-black/50">
                          Липсва: {row.missing_fields.slice(0, 3).map(fieldLabel).join(", ")}{row.missing_fields.length > 3 ? "…" : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-[#0e7a45]">Всички полета попълнени</p>
                      )}
                    </div>
                  </td>

                  {/* City */}
                  <td className="px-3 py-3 text-sm text-black/70">{cityDisplay}</td>

                  {/* Organizer */}
                  <td className="max-w-[12rem] px-3 py-3 text-sm text-black/70">
                    {row.organizer_name?.trim() || <span className="text-black/30">—</span>}
                  </td>

                  {/* Dates */}
                  <td className="px-3 py-3 text-sm text-black/70 whitespace-nowrap">
                    {row.start_date ? (
                      <span>
                        {row.start_date}
                        {row.end_date && row.end_date !== row.start_date ? <><br /><span className="text-black/45">→ {row.end_date}</span></> : null}
                      </span>
                    ) : "—"}
                  </td>

                  {/* Source */}
                  <td className="px-3 py-3 text-sm">
                    {row.source_url ? (
                      <div className="space-y-1">
                        <a
                          href={row.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-blue-600 hover:underline"
                          title={row.source_url}
                        >
                          {domainFrom(row.source_url)}
                        </a>
                        {evidenceSources.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSourcesOpen((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                              className="text-[11px] text-black/40 hover:text-black/70"
                            >
                              {showList ? "▲ скрий" : `▼ +${evidenceSources.length} извора`}
                            </button>
                            {showList && (
                              <ul className="space-y-0.5 text-[11px] text-black/55">
                                {evidenceSources.map((s, idx) => (
                                  <li key={`${row.id}-src-${idx}`}>
                                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                                      {domainFrom(s.url)}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                    ) : <span className="text-black/30">—</span>}
                  </td>

                  {/* Submission source */}
                  <td className="px-3 py-3 text-black/65">
                    {row.submission_source === "organizer_portal" ? (
                      <span className="inline-flex rounded-full border border-[#0c0e14]/20 bg-[#f5f4f0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#0c0e14]">
                        Организатор
                      </span>
                    ) : row.submission_source === "research" ? (
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-blue-700">
                        Проучване
                      </span>
                    ) : row.submission_source ? (
                      <span className="text-xs">{row.submission_source}</span>
                    ) : "—"}
                  </td>

                  {/* Created */}
                  <td className="px-3 py-3 text-xs text-black/55 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" })}
                    <br />
                    <span className="text-black/35">{new Date(row.created_at).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" })}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/admin/pending-festivals/${row.id}`}
                        className="inline-flex justify-center rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-[#f7f6f3]"
                      >
                        Преглед
                      </Link>
                      <button
                        type="button"
                        onClick={() => runAction(row.id, "approve")}
                        disabled={rowBusy}
                        className="inline-flex justify-center rounded-lg border border-[#18a05e]/30 bg-[#18a05e]/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#0e7a45] hover:bg-[#18a05e]/15 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {rowBusy && busyAction === "approve" ? "…" : "Одобри"}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(row.id, "reject")}
                        disabled={rowBusy}
                        className="inline-flex justify-center rounded-lg border border-[#b13a1a]/25 bg-[#b13a1a]/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#9f3115] hover:bg-[#b13a1a]/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {rowBusy && busyAction === "reject" ? "…" : "Отхвърли"}
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
