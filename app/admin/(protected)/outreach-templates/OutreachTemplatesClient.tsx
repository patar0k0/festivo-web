"use client";

import { useState } from "react";

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const EMPTY: Omit<Template, "id" | "created_at" | "updated_at"> = {
  name: "",
  subject: "",
  body: "",
  sort_order: 0,
};

export default function OutreachTemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setEditing({ ...EMPTY });
    setIsNew(true);
    setError("");
  }

  function openEdit(t: Template) {
    setEditing({ ...t });
    setIsNew(false);
    setError("");
  }

  function closeEditor() {
    setEditing(null);
    setIsNew(false);
    setError("");
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.name?.trim()) { setError("Въведи име на шаблона."); return; }
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        const res = await fetch("/admin/api/outreach-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Грешка");
        setTemplates((prev) => [...prev, d.template]);
      } else {
        const res = await fetch(`/admin/api/outreach-templates/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Грешка");
        setTemplates((prev) => prev.map((t) => (t.id === d.template.id ? d.template : t)));
      }
      closeEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Изтрий шаблона?")) return;
    const res = await fetch(`/admin/api/outreach-templates/${id}`, { method: "DELETE" });
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Template list */}
      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-[#0c0e14]">{t.name}</p>
                <p className="text-xs text-black/50 truncate">{t.subject || "(без subject)"}</p>
                <p className="mt-2 line-clamp-2 text-sm text-black/60 whitespace-pre-line">{t.body.slice(0, 200)}…</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => openEdit(t)}
                  className="rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-medium hover:bg-black/[0.03]"
                >
                  Редактирай
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="rounded-lg border border-[#b13a1a]/30 px-3 py-1.5 text-xs font-medium text-[#b13a1a] hover:bg-[#b13a1a]/5"
                >
                  Изтрий
                </button>
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            Няма шаблони. Добави първия.
          </p>
        )}
      </div>

      <button
        onClick={openNew}
        className="rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/80"
      >
        + Нов шаблон
      </button>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-black/[0.08] px-6 py-4">
              <h2 className="text-base font-semibold text-[#0c0e14]">
                {isNew ? "Нов шаблон" : `Редактиране: ${editing.name}`}
              </h2>
              <button onClick={closeEditor} className="rounded-lg p-1.5 text-black/40 hover:bg-black/5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wide text-black/50">Име на шаблона</label>
                <input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                  placeholder="напр. Народни читалища"
                  className="w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-sm focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wide text-black/50">Subject (относно)</label>
                <input
                  value={editing.subject ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-sm focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wide text-black/50">
                  Текст{" "}
                  <span className="normal-case font-normal text-black/40">
                    — използвай {"{{organizerName}}"}, {"{{festivalList}}"}, {"{{claimUrl}}"}
                  </span>
                </label>
                <textarea
                  value={editing.body ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p, body: e.target.value }))}
                  rows={18}
                  className="w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-sm font-mono leading-relaxed resize-y focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wide text-black/50">Ред на сортиране</label>
                <input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                  className="w-24 rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-sm focus:border-[#7c2d12] focus:outline-none"
                />
              </div>

              {error && <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/[0.08] px-6 py-4">
              <button onClick={closeEditor} className="rounded-xl border border-black/[0.12] px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/[0.03]">
                Отказ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[#0c0e14] px-5 py-2 text-sm font-semibold text-white hover:bg-black/80 disabled:opacity-60"
              >
                {saving ? "Записване…" : "Запази"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
