"use client";

import { useState } from "react";

export type PromotionRequestRow = {
  id: string;
  festivalId: string;
  festivalTitle?: string | null;
  organizerName?: string | null;
  userEmail?: string | null;
  city?: string | null;
  startDate?: string | null;
  createdAt: string;
};

type Props = {
  rows: PromotionRequestRow[];
};

function differenceInDays(date: Date, baseDate: Date) {
  const msInDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date.getTime() - baseDate.getTime()) / msInDay);
}

export default function PromotionRequestsTableClient({ rows }: Props) {
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const encodedGreeting = encodeURIComponent("Здравей,");
  const encodedBodyTemplate = encodeURIComponent(
    'видяхме заявката ти за промотиране на "{festivalTitle}".\n\nМожем да ти предложим по-видимо позициониране в платформата.\n\nПоздрави,\nFestivo',
  );

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
            <th className="px-3 py-2 font-semibold">Имейл</th>
            <th className="px-3 py-2 font-semibold">Град</th>
            <th className="px-3 py-2 font-semibold">Дата</th>
            <th className="px-3 py-2 font-semibold">Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const parsedStartDate = row.startDate ? new Date(row.startDate) : null;
            const hasValidStartDate = Boolean(parsedStartDate && !Number.isNaN(parsedStartDate.getTime()));
            const daysDiff = hasValidStartDate ? differenceInDays(parsedStartDate as Date, new Date()) : null;

            return (
              <tr key={row.id} className={`${doneIds.includes(row.id) ? "opacity-50" : ""} border-b`}>
                <td className="px-3 py-2">
                {row.festivalId ? (
                  <a href={`/admin/festivals/${row.festivalId}`} className="text-blue-600 underline">
                    {row.festivalTitle || "—"}
                  </a>
                ) : (
                  row.festivalTitle || "—"
                )}
                </td>
                <td className="px-3">{row.organizerName || "—"}</td>
                <td className="px-3">{row.userEmail || "—"}</td>
                <td className="px-3">{row.city || "—"}</td>
                <td className="px-3 py-2">
                  <div>{hasValidStartDate ? (parsedStartDate as Date).toLocaleDateString("bg-BG") : "—"}</div>
                  {typeof daysDiff === "number" && daysDiff <= 7 ? (
                    <span className="text-xs text-red-600">Спешно</span>
                  ) : null}
                  {typeof daysDiff === "number" && daysDiff > 7 && daysDiff <= 30 ? (
                    <span className="text-xs text-yellow-600">Скоро</span>
                  ) : null}
                </td>
                <td className="space-x-2 px-3">
                <a href={`/admin/festivals/${row.festivalId}`} className="text-blue-600 underline text-sm">
                  Отвори
                </a>

                {row.userEmail ? (
                  <a
                    href={`mailto:${row.userEmail}?subject=Промотиране на ${row.festivalTitle || "фестивал"}&body=${encodedGreeting}%0A%0A${encodedBodyTemplate.replace("{festivalTitle}", row.festivalTitle || "фестивал")}`}
                    className="text-indigo-600 text-sm underline"
                  >
                    Свържи се
                  </a>
                ) : null}

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

                {doneIds.includes(row.id) ? (
                  <span className="text-xs text-gray-400">Обработено</span>
                ) : (
                  <span className="text-xs text-green-600">Ново</span>
                )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
