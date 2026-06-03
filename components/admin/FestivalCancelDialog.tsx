"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "cancel" | "uncancel";

type Props = {
  festivalId: string;
  festivalTitle: string;
  lifecycleState: "active" | "cancelled";
  planUsersCount?: number;
};

export function FestivalCancelDialog({
  festivalId,
  festivalTitle,
  lifecycleState,
  planUsersCount = 0,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(lifecycleState === "cancelled" ? "uncancel" : "cancel");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reasonValid = reason.trim().length >= 20 && reason.trim().length <= 500;
  const confirmValid = confirmText.trim() === festivalTitle.trim();
  const canSubmit = mode === "uncancel" ? !isPending : (reasonValid && confirmValid && !isPending);

  async function handleSubmit() {
    setError(null);
    const url =
      mode === "cancel"
        ? `/admin/api/festivals/${festivalId}/cancel`
        : `/admin/api/festivals/${festivalId}/uncancel`;

    const body = mode === "cancel" ? JSON.stringify({ reason: reason.trim() }) : "{}";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const msg =
        typeof data.message === "string" ? data.message :
        typeof data.error === "string" ? data.error : "Грешка";
      setError(msg);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (lifecycleState === "cancelled") {
    return (
      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-red-700">⚠ Фестивалът е отменен</p>
        <button
          onClick={() => { setMode("uncancel"); setOpen(true); }}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
        >
          Възстанови фестивала
        </button>

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="mb-3 text-lg font-bold">Възстанови фестивала?</h2>
              <p className="mb-4 text-sm text-zinc-600">
                Фестивалът ще бъде отново активен в каталога. Потребителите в плана не получават имейл — трябва ръчно да го добавят обратно.
              </p>
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => { setOpen(false); setError(null); }}
                  className="flex-1 rounded-lg border border-zinc-300 bg-zinc-100 py-2 text-sm font-semibold"
                >
                  Откажи
                </button>
                <button
                  onClick={() => startTransition(handleSubmit)}
                  disabled={!canSubmit}
                  className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isPending ? "Зарежда…" : "Да, възстанови"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-700">Отмяна на фестивал</h3>
      <button
        onClick={() => { setMode("cancel"); setOpen(true); }}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
      >
        Отмени фестивала
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-red-700">⚠ Отмени фестивала</h2>

            {planUsersCount > 0 && (
              <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                <strong>{planUsersCount} потребител{planUsersCount !== 1 ? "и" : ""}</strong>{" "}
                са запазили този фестивал в плана си и ще получат имейл при потвърждаване.
              </div>
            )}

            <label className="mb-1 block text-sm font-semibold">
              Причина за отмяна *{" "}
              <span className="font-normal text-zinc-500">(20–500 символа)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Кратко обяснение за потребителите — напр. лошо време, организационни проблеми…"
              className="mb-1 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className={`mb-4 text-xs ${reason.trim().length < 20 ? "text-red-500" : "text-zinc-500"}`}>
              {reason.trim().length} / 500 символа (минимум 20)
            </p>

            <label className="mb-1 block text-sm font-semibold">
              Въведи точното заглавие за потвърждение:
            </label>
            <code className="mb-2 block rounded bg-zinc-100 px-3 py-1.5 text-xs">{festivalTitle}</code>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Въведи заглавието…"
              className={`mb-4 w-full rounded-lg border px-3 py-2 text-sm ${confirmValid ? "border-green-400" : "border-zinc-300"}`}
            />

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setOpen(false); setError(null); setReason(""); setConfirmText(""); }}
                className="flex-1 rounded-lg border border-zinc-300 bg-zinc-100 py-2 text-sm font-semibold"
              >
                Откажи
              </button>
              <button
                onClick={() => startTransition(handleSubmit)}
                disabled={!canSubmit}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Отменя се…" : "Потвърди отмяната"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
