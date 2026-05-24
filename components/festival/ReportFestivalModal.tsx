"use client";

import { useRef, useState } from "react";

import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";

const CATEGORIES = [
  { value: "wrong_info", label: "Грешна дата, място или цена" },
  { value: "wrong_location", label: "Грешно местоположение на картата" },
  { value: "broken_link", label: "Счупен линк или снимка" },
  { value: "event_cancelled", label: "Фестивалът е отменен" },
  { value: "other", label: "Друго" },
] as const;

type State = "idle" | "submitting" | "success" | "error";

type Props = {
  festivalId: string;
  onClose: () => void;
};

export default function ReportFestivalModal({ festivalId, onClose }: Props) {
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const charCount = message.length;
  const MAX = 1000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;

    const trimmed = message.trim();
    if (!trimmed) {
      setErrorMsg("Моля, опиши проблема.");
      return;
    }

    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/festivals/${festivalId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          turnstileToken: turnstileToken ?? "",
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setState("error");
        setErrorMsg(data.error ?? "Неуспешно изпращане. Опитай отново.");
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        return;
      }

      setState("success");
      setTimeout(() => onClose(), 2500);
    } catch {
      setState("error");
      setErrorMsg("Мрежова грешка. Провери връзката и опитай отново.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4">
          <h2 className="text-base font-bold tracking-tight text-[#0c0e14]">
            Сигнализирай за проблем
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-black/40 hover:bg-black/[0.05] hover:text-black/70"
            aria-label="Затвори"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          {state === "success" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="font-semibold text-[#0c0e14]">Благодарим!</p>
              <p className="text-sm text-black/60">Ще разгледаме сигнала.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
                  Категория
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-sm text-[#0c0e14] focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/30"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
                  Опиши проблема
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                  placeholder="Напр. Датата е грешна — фестивалът е на 15 юни, не 16..."
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-sm text-[#0c0e14] placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/30"
                />
                <p
                  className={`mt-1 text-right text-[11px] ${charCount > MAX * 0.9 ? "text-amber-600" : "text-black/35"}`}
                >
                  {charCount} / {MAX}
                </p>
              </div>

              <TurnstileWidget
                ref={turnstileRef}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                className="mt-1"
              />

              {errorMsg && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="flex-1 rounded-lg bg-[#0c0e14] py-2.5 text-sm font-semibold text-white hover:bg-black/80 disabled:opacity-50"
                >
                  {state === "submitting" ? "Изпращане..." : "Изпрати"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-black/[0.12] py-2.5 text-sm font-semibold text-black/70 hover:bg-black/[0.04]"
                >
                  Откажи
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
