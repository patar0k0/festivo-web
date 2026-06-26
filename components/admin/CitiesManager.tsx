"use client";

import { useMemo, useState } from "react";
import type { AdminCityRow } from "@/app/admin/api/cities/route";

type FilterKind = "all" | "city" | "village" | "none";

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: "all", label: "Всички" },
  { key: "city", label: "Град" },
  { key: "village", label: "Село" },
  { key: "none", label: "Без тип" },
];

function matchesFilter(row: AdminCityRow, filter: FilterKind): boolean {
  if (filter === "all") return true;
  if (filter === "city") return row.is_village === false;
  if (filter === "village") return row.is_village === true;
  return row.is_village === null;
}

export default function CitiesManager({ initial }: { initial: AdminCityRow[] }) {
  const [cities, setCities] = useState<AdminCityRow[]>(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [errorById, setErrorById] = useState<Record<number, string>>({});
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("bg-BG");
    return cities.filter((c) => {
      if (!matchesFilter(c, filter)) return false;
      if (!q) return true;
      return (
        c.name_bg.toLocaleLowerCase("bg-BG").includes(q) ||
        c.slug.toLocaleLowerCase("bg-BG").includes(q)
      );
    });
  }, [cities, query, filter]);

  async function setIsVillage(id: number, next: boolean | null) {
    const previous = cities.find((c) => c.id === id)?.is_village ?? null;
    setErrorById((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    setCities((prev) => prev.map((c) => (c.id === id ? { ...c, is_village: next } : c)));
    setPendingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/admin/api/cities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_village: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Грешка при запис");
      }
    } catch (e) {
      setCities((prev) => prev.map((c) => (c.id === id ? { ...c, is_village: previous } : c)));
      setErrorById((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Грешка при запис" }));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Търси по име или slug…"
          className="w-full max-w-xs rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                filter === f.key
                  ? "border-black/[0.18] bg-black/[0.07] text-[#0c0e14]"
                  : "border-black/[0.1] bg-white text-black/70 hover:bg-[#f7f6f3]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-black/45">{filtered.length} от {cities.length}</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-left text-[10px] font-semibold uppercase tracking-widest text-black/45">
              <th className="px-4 py-3">Име</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Тип</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.name_bg}</td>
                <td className="px-4 py-3 font-mono text-xs text-black/50">{c.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="inline-flex overflow-hidden rounded-lg border border-black/[0.12]">
                      {(
                        [
                          { value: false, label: "Град" },
                          { value: true, label: "Село" },
                          { value: null, label: "Без тип" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          disabled={pendingIds.has(c.id)}
                          onClick={() => setIsVillage(c.id, opt.value)}
                          className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40 ${
                            c.is_village === opt.value
                              ? "bg-[#0c0e14] text-white"
                              : "bg-white text-black/70 hover:bg-black/5"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {errorById[c.id] ? (
                      <p className="text-xs text-red-600">{errorById[c.id]}</p>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
