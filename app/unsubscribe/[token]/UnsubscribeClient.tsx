"use client";

import { useState } from "react";

type Props = {
  token: string;
};

export function UnsubscribeClient({ token }: Props) {
  const [busy, setBusy] = useState<"reminder" | "all" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "reminder_emails_off" | "all_optional_off") {
    setBusy(action === "reminder_emails_off" ? "reminder" : "all");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(json.error ?? "Заявката не беше приета. Опитай отново по-късно.");
        return;
      }
      if (action === "all_optional_off") {
        setMessage("Спряхме всички опционални имейли за този акаунт (напомняния и бъдещи маркетинг съобщения).");
      } else {
        setMessage("Спряхме имейл напомнянията за запазени фестивали. Push в приложението не се променя оттук.");
      }
    } catch {
      setError("Мрежова грешка. Провери връзката и опитай пак.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-black/70">
        Избери какво да изключим.{" "}
        <span className="text-black/55">
          Имейли за сигурност, заявки към организатори и админски известия не се спират от тази страница.
        </span>
      </p>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-950" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy !== null || !!message}
          onClick={() => void submit("reminder_emails_off")}
          className="inline-flex items-center justify-center rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "reminder" ? "Запазване…" : "Спри само имейл напомнянията"}
        </button>
        <button
          type="button"
          disabled={busy !== null || !!message}
          onClick={() => void submit("all_optional_off")}
          className="inline-flex items-center justify-center rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0e14] transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "all" ? "Запазване…" : "Спри всички опционални имейли"}
        </button>
      </div>
    </div>
  );
}
