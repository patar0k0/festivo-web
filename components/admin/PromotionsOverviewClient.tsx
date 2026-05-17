"use client";

import { useMemo, useState } from "react";
import {
  getStatus,
  type PromotedFestivalRow,
  type PromotionExpiryStatus,
} from "@/lib/admin/promotionsOverview";

type FilterKey = "all" | PromotionExpiryStatus;

const FILTER_KEYS: FilterKey[] = ["all", "active", "expiring", "expired"];

export default function PromotionsOverviewClient({ data }: { data: PromotedFestivalRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const { active, expiring, expired } = useMemo(() => {
    const active = data.filter((f) => getStatus(f.promotion_expires_at) === "active");
    const expiring = data.filter((f) => getStatus(f.promotion_expires_at) === "expiring");
    const expired = data.filter((f) => getStatus(f.promotion_expires_at) === "expired");
    return { active, expiring, expired };
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((f) => {
      const status = getStatus(f.promotion_expires_at);
      if (filter === "all") return true;
      return status === filter;
    });
  }, [data, filter]);

  const sorted = useMemo(() => {
    const order: Record<PromotionExpiryStatus, number> = { expiring: 0, active: 1, expired: 2 };
    return [...filtered].sort((a, b) => {
      const sa = getStatus(a.promotion_expires_at);
      const sb = getStatus(b.promotion_expires_at);

      if (order[sa] !== order[sb]) {
        return order[sa] - order[sb];
      }

      return (
        new Date(a.promotion_expires_at || 0).getTime() - new Date(b.promotion_expires_at || 0).getTime()
      );
    });
  }, [filtered]);

  if (data.length === 0) {
    return (
      <>
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <div>Общо: 0</div>
          <div className="text-green-600">Активни: 0</div>
          <div className="text-yellow-600">Изтичат скоро: 0</div>
          <div className="text-red-600">Изтекли: 0</div>
        </div>
        <p className="text-sm text-gray-500">Няма активни промотирани фестивали</p>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <div>Общо: {data.length}</div>
        <div className="text-green-600">Активни: {active.length}</div>
        <div className="text-yellow-600">Изтичат скоро: {expiring.length}</div>
        <div className="text-red-600">Изтекли: {expired.length}</div>
      </div>

      <div className="mb-4 flex gap-2">
        {FILTER_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded px-3 py-1 text-sm ${filter === k ? "bg-black text-white" : "bg-gray-100"}`}
          >
            {k === "all" && "Всички"}
            {k === "active" && "Активни"}
            {k === "expiring" && "Изтичащи"}
            {k === "expired" && "Изтекли"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">Няма резултати за този филтър</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold uppercase tracking-wide text-gray-600">
                <th className="py-2 pr-3">Фестивал</th>
                <th className="py-2 pr-3">Организатор</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 pr-3">Изтича</th>
                <th className="py-2 pr-3">Ранг</th>
                <th className="py-2 text-left text-sm font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => {
                const status = getStatus(f.promotion_expires_at);
                return (
                  <tr
                    key={f.id}
                    className={`
                    border-b
                    ${status === "expiring" ? "bg-yellow-50" : ""}
                    ${status === "expired" ? "bg-red-50" : ""}
                  `}
                  >
                    <td className="py-2">
                      <a
                        href={`/festivals/${f.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {f.title}
                      </a>
                    </td>

                    <td>{f.organizer?.name ?? "—"}</td>

                    <td>
                      <span
                        className={`
                        rounded px-2 py-1 text-xs
                        ${status === "active" ? "bg-green-100 text-green-700" : ""}
                        ${status === "expiring" ? "bg-yellow-100 text-yellow-700" : ""}
                        ${status === "expired" ? "bg-red-100 text-red-700" : ""}
                      `}
                      >
                        {status === "active" && "Активен"}
                        {status === "expiring" && "Изтича скоро"}
                        {status === "expired" && "Изтекъл"}
                      </span>
                    </td>

                    <td>
                      {f.promotion_expires_at
                        ? new Date(f.promotion_expires_at).toLocaleDateString("bg-BG")
                        : "—"}
                    </td>

                    <td>
                      {f.promotion_rank ? (
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs">#{f.promotion_rank}</span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>
                      <a
                        href={`/admin/festivals/${f.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Управление
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
