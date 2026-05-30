"use client";

import { useState, useTransition } from "react";

type Category = {
  slug: string;
  label_bg: string;
  sort_order: number;
  is_active: boolean;
  festival_count: number;
};

export default function CategoriesManager({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initial);
  const [newLabel, setNewLabel] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reload() {
    const r = await fetch("/admin/api/festival-categories");
    if (r.ok) {
      const { categories: cats } = await r.json();
      setCategories(cats);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const label_bg = newLabel.trim();
    if (!label_bg) return;
    const sort_order = parseInt(newOrder) || categories.length + 1;

    startTransition(async () => {
      const r = await fetch("/admin/api/festival-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_bg, sort_order }),
      });
      if (r.ok) {
        setNewLabel("");
        setNewOrder("");
        await reload();
      } else {
        const { error: err } = await r.json();
        setError(err ?? "Грешка при добавяне");
      }
    });
  }

  async function handleToggle(slug: string, is_active: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/admin/api/festival-categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !is_active }),
      });
      if (r.ok) await reload();
      else setError("Грешка при промяна");
    });
  }

  async function handleRename(slug: string, current: string) {
    const label_bg = window.prompt("Нов лейбъл:", current);
    if (!label_bg || label_bg.trim() === current) return;
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/admin/api/festival-categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_bg: label_bg.trim() }),
      });
      if (r.ok) await reload();
      else setError("Грешка при преименуване");
    });
  }

  async function handleReorder(slug: string, current: number) {
    const input = window.prompt("Нов ред (число):", String(current));
    if (!input) return;
    const sort_order = parseInt(input);
    if (isNaN(sort_order)) return;
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/admin/api/festival-categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order }),
      });
      if (r.ok) await reload();
      else setError("Грешка при пренареждане");
    });
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="flex items-end gap-3 rounded-2xl border border-black/[0.08] bg-white/85 p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-black/50">
            Лейбъл
          </label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="напр. Религиозен фестивал"
            className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="w-20">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-black/50">
            Ред
          </label>
          <input
            type="number"
            value={newOrder}
            onChange={(e) => setNewOrder(e.target.value)}
            placeholder={String(categories.length + 1)}
            className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !newLabel.trim()}
          className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40"
        >
          Добави
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-left text-[10px] font-semibold uppercase tracking-widest text-black/45">
              <th className="px-4 py-3">Ред</th>
              <th className="px-4 py-3">Лейбъл</th>
              <th className="px-4 py-3">Slug (в DB)</th>
              <th className="px-4 py-3">Фестивали</th>
              <th className="px-4 py-3">Активна</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {categories.map((cat) => (
              <tr key={cat.slug} className={cat.is_active ? "" : "opacity-45"}>
                <td className="px-4 py-3 text-black/50">{cat.sort_order}</td>
                <td className="px-4 py-3 font-medium">{cat.label_bg}</td>
                <td className="px-4 py-3 font-mono text-xs text-black/50">{cat.slug}</td>
                <td className="px-4 py-3 text-black/70">{cat.festival_count}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      cat.is_active ? "bg-green-50 text-green-700" : "bg-black/5 text-black/40"
                    }`}
                  >
                    {cat.is_active ? "Да" : "Не"}
                  </span>
                </td>
                <td className="flex gap-2 px-4 py-3">
                  <button
                    onClick={() => handleRename(cat.slug, cat.label_bg)}
                    disabled={isPending}
                    className="rounded-lg border border-black/[0.1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-black/5 disabled:opacity-40"
                  >
                    Преимен.
                  </button>
                  <button
                    onClick={() => handleReorder(cat.slug, cat.sort_order)}
                    disabled={isPending}
                    className="rounded-lg border border-black/[0.1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-black/5 disabled:opacity-40"
                  >
                    Ред
                  </button>
                  <button
                    onClick={() => handleToggle(cat.slug, cat.is_active)}
                    disabled={isPending}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-40 ${
                      cat.is_active
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-green-200 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {cat.is_active ? "Деакт." : "Активир."}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
