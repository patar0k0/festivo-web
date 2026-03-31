"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";

type AdminFestivalRow = {
  id: string;
  title: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  occurrence_dates?: unknown;
  category: string | null;
  is_free: boolean | null;
  status: "draft" | "verified" | "rejected" | "archived" | null;
  updated_at: string | null;
  source_type: string | null;
};

export default function FestivalsTable({ rows }: { rows: AdminFestivalRow[] }) {
  const router = useRouter();
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

      if (!response.ok) {
        throw new Error("Неуспешна bulk операция.");
      }

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
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center text-sm text-black/60">Няма резултати за избраните филтри.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runBulkAction("verified")}
          disabled={!selectedIds.length || Boolean(pendingAction)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Mark verified
        </button>
        <button
          type="button"
          onClick={() => runBulkAction("rejected")}
          disabled={!selectedIds.length || Boolean(pendingAction)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => runBulkAction("archived")}
          disabled={!selectedIds.length || Boolean(pendingAction)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Archive
        </button>
        <p className="ml-auto text-xs text-black/55">Selected: {selectedIds.length}</p>
      </div>

      {message ? <p className="rounded-lg bg-[#0c0e14]/5 px-3 py-2 text-sm text-[#0c0e14]">{message}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
            <tr>
              <th className="px-3 py-3">
                <input type="checkbox" checked={isAllSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-3">Title</th>
              <th className="px-3 py-3">City</th>
              <th className="px-3 py-3">Start-End</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Free</th>
              <th className="px-3 py-3">State</th>
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.map((row) => {
              const isArchived = row.status === "archived";

              return (
                <tr key={row.id} className="hover:bg-black/[0.02]">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.title}`}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-[#0c0e14]">{row.title}</td>
                  <td className="px-3 py-3 text-black/65">{row.city ?? "-"}</td>
                  <td className="px-3 py-3 text-black/65">{formatFestivalDateLineShort(row)}</td>
                  <td className="px-3 py-3 text-black/65">
                    {row.category ? labelForPublicCategory(row.category) : "-"}
                  </td>
                  <td className="px-3 py-3 text-black/65">{row.is_free ? "Yes" : "No"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isArchived ? "bg-[#f8decf] text-[#b13a1a]" : "bg-[#dcf5e7] text-[#0e7a45]"
                      }`}
                    >
                      {isArchived ? "Archived" : "Active"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-black/65">{row.updated_at ? new Date(row.updated_at).toLocaleString("bg-BG") : "-"}</td>
                  <td className="px-3 py-3 text-black/65">{row.source_type ?? "-"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/festivals/${row.id}`}
                        className="inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => runRowArchiveAction(row.id, isArchived ? "restore" : "archive")}
                        disabled={Boolean(pendingAction)}
                        className="inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3] disabled:opacity-50"
                      >
                        {isArchived ? "Restore" : "Archive"}
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
