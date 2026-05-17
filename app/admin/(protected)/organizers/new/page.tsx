"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function NewOrganizerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/organizers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; row?: { id: string } };
      if (!res.ok) throw new Error(data.error || "Failed to create organizer");
      router.push(`/admin/organizers/${data.row!.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6">
      <h1 className="text-xl font-bold tracking-tight">Нов организатор</h1>
      <p className="mt-1 text-sm text-black/55">Въведете името. Slug се генерира автоматично — може да го промените след създаването.</p>
      <form onSubmit={onSubmit} className="mt-6 max-w-sm space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Име</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='НЧ „Искра-1912"'
            autoFocus
            className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {saving ? "Създаване…" : "Създай"}
          </button>
          <a
            href="/admin/organizers"
            className="inline-flex items-center rounded-lg border border-black/[0.12] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.03]"
          >
            Отказ
          </a>
        </div>
      </form>
    </div>
  );
}
