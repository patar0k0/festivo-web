"use client";

import { useState } from "react";

export type PromotionRequestRow = {
  id: string;
  festivalId: string;
  festivalTitle?: string | null;
  organizerName?: string | null;
  createdAt: string;
};

type Props = {
  rows: PromotionRequestRow[];
};

export default function PromotionRequestsTableClient({ rows }: Props) {
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleActivate(festivalId: string) {
    if (!festivalId) {
      console.error("failed");
      return;
    }

    setLoadingId(festivalId);
    try {
      const res = await fetch("/admin/api/promotions/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ festivalId }),
      });

      if (res.ok) {
        console.log("activated");
      } else {
        console.error("failed");
      }
    } catch {
      console.error("failed");
    } finally {
      setLoadingId((curr) => (curr === festivalId ? null : curr));
    }
  }

  function handleDone(jobId: string) {
    console.log("mark done", jobId);
    setDoneIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/[0.08] bg-white/90">
      <table className="w-full text-sm">
        <thead className="bg-black/[0.03] text-left">
          <tr>
            <th className="px-3 py-2 font-semibold">Фестивал</th>
            <th className="px-3 py-2 font-semibold">Организатор</th>
            <th className="px-3 py-2 font-semibold">Дата</th>
            <th className="px-3 py-2 font-semibold">Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={`${doneIds.includes(row.id) ? "opacity-50" : ""} border-b`}>
              <td className="px-3 py-2">{row.festivalTitle || "—"}</td>
              <td className="px-3">{row.organizerName || "—"}</td>
              <td className="px-3">{new Date(row.createdAt).toLocaleDateString("bg-BG")}</td>
              <td className="space-x-2 px-3">
                <a href={`/admin/festivals/${row.festivalId}`} className="text-blue-600 underline text-sm">
                  Отвори
                </a>

                <button
                  onClick={() => handleActivate(row.festivalId)}
                  disabled={loadingId === row.festivalId || !row.festivalId}
                  className="text-green-600 text-sm underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingId === row.festivalId ? "Активиране..." : "Активирай"}
                </button>

                <button onClick={() => handleDone(row.id)} className="text-gray-500 text-sm underline">
                  Готово
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
