"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Festival = {
  id: string;
  title: string;
  description: string | null;
  description_short: string | null;
  website_url: string | null;
  ticket_url: string | null;
  price_range: string | null;
  is_free: boolean | null;
};

export function FestivalEditForm({ festival }: { festival: Festival }) {
  const router = useRouter();
  const [form, setForm] = useState({
    description: festival.description ?? "",
    description_short: festival.description_short ?? "",
    website_url: festival.website_url ?? "",
    ticket_url: festival.ticket_url ?? "",
    price_range: festival.price_range ?? "",
    is_free: Boolean(festival.is_free),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/organizer/festivals/${festival.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Грешка при запис");
      return;
    }
    setMessage("Запазено.");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-black/10 bg-white p-5"
    >
      <h2 className="text-sm font-medium text-black/75">Основна информация</h2>

      <label className="block text-sm">
        Кратко описание
        <input
          type="text"
          maxLength={200}
          value={form.description_short}
          onChange={(e) => onChange("description_short", e.target.value)}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Описание
        <textarea
          rows={6}
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-sm">
          Уебсайт
          <input
            type="url"
            value={form.website_url}
            onChange={(e) => onChange("website_url", e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Билети (линк)
          <input
            type="url"
            value={form.ticket_url}
            onChange={(e) => onChange("ticket_url", e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Цена (диапазон)
          <input
            type="text"
            value={form.price_range}
            onChange={(e) => onChange("price_range", e.target.value)}
            placeholder="напр. 20-40 лв."
            className="ml-2 rounded-md border border-black/10 px-3 py-1.5"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_free}
            onChange={(e) => onChange("is_free", e.target.checked)}
          />
          Безплатно
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[#0c0e14] px-4 py-2 text-sm font-medium text-white hover:bg-black/85 disabled:opacity-50"
        >
          {busy ? "Запис..." : "Запази"}
        </button>
        {message ? <span className="text-xs text-emerald-700">{message}</span> : null}
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
    </form>
  );
}
