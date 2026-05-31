"use client";

import { useState } from "react";

type Festival = {
  id: string;
  title: string;
  slug: string | null;
};

type Props = {
  organizerId: string;
  organizerName: string;
  organizerEmail: string | null;
  festivals: Festival[];
  onClose: () => void;
};

function buildEmailBody(organizerName: string, festivals: Festival[], siteUrl: string): string {
  const festivalLines = festivals
    .filter((f) => f.slug)
    .map((f) => `  • ${f.title} — ${siteUrl}/festivals/${f.slug}`)
    .join("\n");

  return `Здравейте,

Казвам се Боко и съм основателят на Festivo.bg — каталогът на фестивалите в България.

Фестивалите на ${organizerName} вече са в платформата:

${festivalLines}

Поканваме ви да заявите профила си безплатно на:
${siteUrl}/organizer/claim

След като заявите профила, ще получите достъп до организаторско табло, от което можете да редактирате описания и снимки, да добавяте нови фестивали и да виждате колко хора са ги добавили в плановете си.

За 2026 г. предлагаме безплатен VIP Организатор статус — по-добро класиране в резултатите и отличителен знак на вашия профил.

Ако имате въпроси, отговорете директно на този имейл.

Поздрави,
Боко
Festivo.bg | admin@festivo.bg`;
}

export default function OrganizerOutreachModal({
  organizerId,
  organizerName,
  organizerEmail,
  festivals,
  onClose,
}: Props) {
  const siteUrl = "https://festivo.bg";
  const publishedFestivals = festivals.filter((f) => f.slug);

  const [toEmail, setToEmail] = useState(organizerEmail ?? "");
  const [body, setBody] = useState(() => buildEmailBody(organizerName, publishedFestivals, siteUrl));
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const subject = `Festivo.bg — вашите фестивали вече са в каталога`;

  async function handleSend() {
    if (!toEmail.trim() || !toEmail.includes("@")) {
      setErrorMsg("Въведете валиден имейл адрес.");
      return;
    }
    if (publishedFestivals.length === 0) {
      setErrorMsg("Организаторът няма публикувани фестивали с slug.");
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/admin/api/organizer-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId,
          recipientEmail: toEmail.trim(),
          organizerName,
          festivals: publishedFestivals
            .filter((f) => f.slug)
            .map((f) => ({
              title: f.title,
              url: `${siteUrl}/festivals/${f.slug}`,
            })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Грешка при изпращане.");
      }

      setStatus("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Неочаквана грешка.");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.08] px-6 py-4">
          <h2 className="text-base font-semibold text-[#0c0e14]">
            Изпрати покана — {organizerName}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-black/40 hover:bg-black/5 hover:text-black/70"
            aria-label="Затвори"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* To */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-black/50 uppercase tracking-wide">До</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="organizer@example.com"
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3.5 py-2.5 text-sm text-[#0c0e14] placeholder:text-black/30 focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-black/50 uppercase tracking-wide">Относно</label>
            <div className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-3.5 py-2.5 text-sm text-black/60 select-all">
              {subject}
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-black/50 uppercase tracking-wide">
              Текст{" "}
              <span className="normal-case font-normal text-black/40">(редактируем)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3.5 py-2.5 text-sm text-[#0c0e14] leading-relaxed font-mono resize-y focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
            />
          </div>

          {/* Festivals list */}
          {publishedFestivals.length === 0 && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Организаторът няма публикувани фестивали с slug — имейлът ще бъде изпратен без линкове.
            </p>
          )}

          {/* Error */}
          {errorMsg && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </p>
          )}

          {/* Sent */}
          {status === "sent" && (
            <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              ✓ Имейлът е поставен в опашката за изпращане.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-black/[0.08] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-black/[0.12] px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/[0.03]"
          >
            Затвори
          </button>
          {status === "sent" ? null : (
            <button
              onClick={handleSend}
              disabled={status === "sending"}
              className="rounded-xl bg-[#7c2d12] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6b2510] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "sending" ? "Изпращане…" : "Изпрати имейл"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
