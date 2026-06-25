"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import type { PendingQualityBucket } from "@/lib/admin/pendingFestivalQuality";
import type { AdminFestivalRow } from "@/app/admin/(protected)/festivals/page";

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
  category_or_tags: "категория или тагове",
  tags: "тагове",
  source_url: "уебсайт",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function bucketStyle(bucket: PendingQualityBucket) {
  if (bucket === "ready") return "border-[#18a05e]/30 bg-[#18a05e]/10 text-[#0e7a45]";
  if (bucket === "needs_fix") return "border-[#b8891e]/30 bg-[#fff7e6] text-[#8a6516]";
  return "border-[#b13a1a]/30 bg-[#fff1ec] text-[#9f3115]";
}

function bucketLabel(bucket: PendingQualityBucket) {
  if (bucket === "ready") return "Пълен";
  if (bucket === "needs_fix") return "Непълен";
  return "Слаб";
}

function temporalLabel(row: AdminFestivalRow): { text: string; style: string } {
  const state = getFestivalTemporalState({
    start_date: row.start_date,
    end_date: row.end_date,
    occurrence_dates: row.occurrence_dates,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
  });
  switch (state) {
    case "upcoming":
      return { text: "Предстоящ", style: "border-[#1a6bab]/20 bg-blue-50 text-blue-700" };
    case "ongoing":
      return { text: "Текущ", style: "border-[#18a05e]/30 bg-[#18a05e]/10 text-[#0e7a45]" };
    case "past":
      return { text: "Минал", style: "border-black/10 bg-black/[0.04] text-black/45" };
  }
}

function statusStyle(status: AdminFestivalRow["status"]): string {
  switch (status) {
    case "verified": return "bg-[#dcf5e7] text-[#0e7a45]";
    case "draft": return "bg-[#fff7e6] text-[#8a6516]";
    case "rejected": return "bg-[#fff1ec] text-[#9f3115]";
    case "archived": return "bg-[#f8decf] text-[#b13a1a]";
    default: return "bg-black/[0.05] text-black/50";
  }
}

function statusLabel(status: AdminFestivalRow["status"]): string {
  switch (status) {
    case "verified": return "Активен";
    case "draft": return "Чернова";
    case "rejected": return "Отхвърлен";
    case "archived": return "Архивиран";
    default: return status ?? "—";
  }
}

export default function FestivalsTable({
  rows,
  qualityFilter,
  qualityCounts,
}: {
  rows: AdminFestivalRow[];
  qualityFilter?: PendingQualityBucket | "";
  qualityCounts: Record<PendingQualityBucket, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const isAllSelected = useMemo(() => rows.length > 0 && selectedIds.length === rows.length, [rows.length, selectedIds]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((row) => row.id)));
  };

  const setQualityFilter = (bucket: PendingQualityBucket | "") => {
    const next = new URLSearchParams(searchParams.toString());
    if (!bucket) {
      next.delete("quality");
    } else {
      next.set("quality", bucket);
    }
    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  };

  const runBulkAction = async (status: "verified" | "rejected" | "archived") => {
    if (!selectedIds.length || pendingAction) return;
    setPendingAction(status);
    setMessage("");
    try {
      const response = await fetch("/admin/api/festivals/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      if (!response.ok) throw new Error("Неуспешна bulk операция.");
      setMessage("Статусите са обновени.");
      setSelectedIds([]);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setPendingAction(null);
    }
  };

  const runRowArchiveAction = async (id: string, action: "archive" | "restore") => {
    if (pendingAction) return;
    setPendingAction(`${action}:${id}`);
    setMessage("");
    try {
      const response = await fetch(`/admin/api/festivals/${id}/archive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Неуспешно обновяване на статуса.");
      }
      setMessage(action === "archive" ? "Фестивалът е архивиран." : "Фестивалът е възстановен.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setPendingAction(null);
    }
  };

  if (!rows.length) {
    return (
      <div className="space-y-4">
        {/* Quality filter tabs — shown even when empty so user can switch back */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/[0.08] bg-white/85 p-3 text-xs">
          {(
            [
              { key: "" as const, label: "Всички" },
              { key: "ready" as const, label: `Пълни (${qualityCounts.ready})` },
              { key: "needs_fix" as const, label: `Непълни (${qualityCounts.needs_fix})` },
              { key: "weak" as const, label: `Слаби (${qualityCounts.weak})` },
            ] as { key: PendingQualityBucket | ""; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setQualityFilter(key)}
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
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center text-sm text-black/60">
          {qualityFilter ? "Няма фестивали в тази категория." : "Няма резултати за избраните филтри."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quality filter tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/[0.08] bg-white/85 p-3 text-xs">
        {(
          [
            { key: "" as const, label: "Всички" },
            { key: "ready" as const, label: `Пълни (${qualityCounts.ready})` },
            { key: "needs_fix" as const, label: `Непълни (${qualityCounts.needs_fix})` },
            { key: "weak" as const, label: `Слаби (${qualityCounts.weak})` },
          ] as { key: PendingQualityBucket | ""; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setQualityFilter(key)}
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

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runBulkAction("verified")}
          disabled={!selectedIds.length || Boolean(pendingAction)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Потвърди
        </button>
        <button
          type="button"
          onClick={() => runBulkAction("rejected")}
          disabled={!selectedIds.length || Boolean(pendingAction)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Отхвърли
        </button>
        <button
          type="button"
          onClick={() => runBulkAction("archived")}
          disabled={!selectedIds.length || Boolean(pendingAction)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Архивирай
        </button>
        <p className="ml-auto text-xs text-black/55">Избрани: {selectedIds.length}</p>
      </div>

      {message ? <p className="rounded-lg bg-[#0c0e14]/5 px-3 py-2 text-sm text-[#0c0e14]">{message}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
            <tr>
              <th className="px-3 py-3">
                <input type="checkbox" checked={isAllSelected} onChange={toggleAll} aria-label="Избери всички" />
              </th>
              <th className="px-3 py-3">Заглавие</th>
              <th className="px-3 py-3">Качество</th>
              <th className="px-3 py-3">Град</th>
              <th className="px-3 py-3">Дати</th>
              <th className="px-3 py-3">Статус</th>
              <th className="px-3 py-3">Категория</th>
              <th className="px-3 py-3">Вход</th>
              <th className="px-3 py-3">Обновен</th>
              <th className="px-3 py-3">Тип</th>
              <th className="px-3 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.map((row) => {
              const isArchived = row.status === "archived";
              const temporal = temporalLabel(row);

              return (
                <tr key={row.id} className="hover:bg-black/[0.02]">
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Избери ${row.title}`}
                    />
                  </td>

                  {/* Title */}
                  <td className="max-w-[18rem] px-3 py-3 font-medium text-[#0c0e14]">
                    <Link href={`/admin/festivals/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                    {row.last_edited_by_organizer_at ? (
                      <span
                        className="ml-2 inline-flex rounded-full border border-[#7c2d12]/30 bg-[#7c2d12]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7c2d12]"
                        title={`Последно редактирано от организатор: ${new Date(row.last_edited_by_organizer_at).toLocaleString("bg-BG")}`}
                      >
                        Ред. от организатор
                      </span>
                    ) : null}
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
                  <td className="px-3 py-3 text-sm text-black/65">{row.city ?? "—"}</td>

                  {/* Dates */}
                  <td className="px-3 py-3 text-sm text-black/65 whitespace-nowrap">
                    <div>{formatFestivalDateLineShort(row)}</div>
                    <span className={`mt-0.5 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${temporal.style}`}>
                      {temporal.text}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="px-3 py-3 text-sm text-black/65">
                    {row.category ? labelForPublicCategory(row.category) : <span className="text-black/30">—</span>}
                  </td>

                  {/* Free */}
                  <td className="px-3 py-3 text-sm text-black/65">
                    {row.is_free === true ? (
                      <span className="text-[#0e7a45]">Да</span>
                    ) : row.is_free === false ? (
                      <span>Не</span>
                    ) : (
                      <span className="text-black/30">—</span>
                    )}
                  </td>

                  {/* Updated */}
                  <td className="px-3 py-3 text-xs text-black/55 whitespace-nowrap">
                    {row.updated_at ? (
                      <>
                        {new Date(row.updated_at).toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" })}
                        <br />
                        <span className="text-black/35">{new Date(row.updated_at).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" })}</span>
                      </>
                    ) : "—"}
                  </td>

                  {/* Source */}
                  <td className="px-3 py-3 text-black/65">
                    {row.source_type === "research" ? (
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-blue-700">
                        Проучване
                      </span>
                    ) : row.source_type === "organizer_portal" ? (
                      <span className="inline-flex rounded-full border border-[#0c0e14]/20 bg-[#f5f4f0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#0c0e14]">
                        Организатор
                      </span>
                    ) : row.source_type === "manual" ? (
                      <span className="inline-flex rounded-full border border-black/[0.12] bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-black/55">
                        Ръчен
                      </span>
                    ) : row.source_type ? (
                      <span className="inline-flex rounded-full border border-black/[0.1] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-black/50">
                        {row.source_type}
                      </span>
                    ) : (
                      <span className="text-black/30">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/admin/festivals/${row.id}`}
                        className="inline-flex justify-center rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-[#f7f6f3]"
                      >
                        Редактирай
                      </Link>
                      <button
                        type="button"
                        onClick={() => runRowArchiveAction(row.id, isArchived ? "restore" : "archive")}
                        disabled={Boolean(pendingAction)}
                        className={`inline-flex justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50 ${
                          isArchived
                            ? "border-[#18a05e]/30 bg-[#18a05e]/8 text-[#0e7a45] hover:bg-[#18a05e]/15"
                            : "border-black/[0.1] bg-white hover:bg-[#f7f6f3]"
                        }`}
                      >
                        {isArchived ? "Възстанови" : "Архивирай"}
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
