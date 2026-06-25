"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

type OutreachHistoryItem = {
  id: string;
  recipient_email: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  last_error: string | null;
  delivery_event: string | null;
  delivery_at: string | null;
};

type DeliveryBadgeProps = { event: string | null };

function DeliveryBadge({ event }: DeliveryBadgeProps) {
  if (!event) return null;
  const map: Record<string, { label: string; className: string }> = {
    "email.delivered":  { label: "Доставен",   className: "bg-emerald-100 text-emerald-700" },
    "email.sent":       { label: "Изпратен",    className: "bg-blue-100 text-blue-700" },
    "email.suppressed": { label: "Потиснат",    className: "bg-red-100 text-red-700" },
    "email.bounced":    { label: "Отбит",       className: "bg-orange-100 text-orange-700" },
    "email.complained": { label: "Спам",        className: "bg-red-100 text-red-700" },
  };
  const cfg = map[event] ?? { label: event.replace("email.", ""), className: "bg-black/10 text-black/60" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

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

const SITE_URL = "https://festivo.bg";

/** Replace {{placeholders}} with actual values. */
function applyPlaceholders(text: string, organizerName: string, festivals: Festival[]): string {
  const festivalLines = festivals
    .filter((f) => f.slug)
    .map((f) => `  • ${f.title} — ${SITE_URL}/festivals/${f.slug}`)
    .join("\n");

  return text
    .replace(/\{\{organizerName\}\}/g, organizerName)
    .replace(/\{\{festivalList\}\}/g, festivalLines || "(няма публикувани фестивали)")
    .replace(/\{\{claimUrl\}\}/g, `${SITE_URL}/organizer`);
}

/** Default body shown before templates load. */
function defaultBody(organizerName: string, festivals: Festival[]): string {
  const festivalLines = festivals
    .filter((f) => f.slug)
    .map((f) => `  • ${f.title} — ${SITE_URL}/festivals/${f.slug}`)
    .join("\n");

  return `Здравейте,

Казвам се Борислав — направих Festivo.bg, сайт за фестивали в България. Исках да има едно място, откъдето хората да намират местни събори, фолклорни фестивали и градски празници — неща, за които иначе научаваш само ако случайно минеш покрай плакат.

Фестивалите на ${organizerName} вече са там:

${festivalLines}

Хората, които намерят вашия фестивал, могат да го запазят в „Моят план" и получават напомняне преди началото — полезно, защото такива неща лесно се забравят.

Ако поемете профила си, можете сами да редактирате информацията, да добавяте снимки и да виждате колко души са проявили интерес. Процесът е бърз:
${SITE_URL}/organizer

За тази година давам безплатен VIP статус на читалища, общини и по-малки организатори — по-добро класиране в сайта и малка отличителна значка. Без скрити условия.

Ако имате въпроси — пишете ми директно на този имейл.

Борислав
Festivo.bg — https://festivo.bg
b.yakov@festivo.bg`;
}

const DEFAULT_SUBJECT = "Festivo.bg — фестивалите на вашата организация вече са в каталога";

export default function OrganizerOutreachModal({
  organizerId,
  organizerName,
  organizerEmail,
  festivals,
  onClose,
}: Props) {
  const publishedFestivals = festivals.filter((f) => f.slug);

  const [toEmail, setToEmail] = useState(organizerEmail ?? "");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(() => defaultBody(organizerName, publishedFestivals));
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<OutreachHistoryItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Load history + templates on mount
  useEffect(() => {
    fetch(`/admin/api/organizer-outreach?organizerId=${encodeURIComponent(organizerId)}`)
      .then((r) => r.json())
      .then((d: { items?: OutreachHistoryItem[] }) => setHistory(d.items ?? []))
      .catch(() => {});

    fetch("/admin/api/outreach-templates")
      .then((r) => r.json())
      .then((d: { templates?: Template[] }) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, [organizerId, status]);

  function applyTemplate(templateId: string) {
    const t = templates.find((tmpl) => tmpl.id === templateId);
    if (!t) return;
    setSelectedTemplateId(templateId);
    setSubject(applyPlaceholders(t.subject, organizerName, publishedFestivals));
    setBody(applyPlaceholders(t.body, organizerName, publishedFestivals));
  }

  async function handleSend() {
    if (!toEmail.trim() || !toEmail.includes("@")) {
      setErrorMsg("Въведете валиден имейл адрес.");
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
          festivals: publishedFestivals.map((f) => ({
            title: f.title,
            url: `${SITE_URL}/festivals/${f.slug}`,
          })),
          subject: subject.trim(),
          rawBody: body.trim(),
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
          <h2 className="text-base font-semibold text-[#0c0e14]">Изпрати покана — {organizerName}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-black/40 hover:bg-black/5" aria-label="Затвори">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Template selector */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wide text-black/50">Шаблон</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="flex-1 rounded-xl border border-black/[0.12] bg-white px-3.5 py-2.5 text-sm text-[#0c0e14] focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
                >
                  <option value="">— избери шаблон —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <a
                  href="/admin/outreach-templates"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-xl border border-black/[0.12] px-3 py-2 text-xs font-medium text-black/50 hover:bg-black/[0.03]"
                >
                  Управлявай
                </a>
              </div>
            </div>
          )}

          {/* To */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wide text-black/50">До</label>
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
            <label className="block text-xs font-medium uppercase tracking-wide text-black/50">Относно</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3.5 py-2.5 text-sm text-[#0c0e14] focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wide text-black/50">
              Текст <span className="normal-case font-normal text-black/40">(редактируем)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3.5 py-2.5 text-sm text-[#0c0e14] leading-relaxed font-mono resize-y focus:border-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/20"
            />
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-black/50">История</p>
              <div className="rounded-xl border border-black/[0.08] divide-y divide-black/[0.06] overflow-hidden">
                {history.map((item) => {
                  const date = item.sent_at ?? item.created_at;
                  const dateStr = format(new Date(date), "d MMM yyyy, HH:mm", { locale: bg });
                  const isFailed = item.status === "failed";
                  const isPending = item.status === "pending";
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm bg-white">
                      <div className="min-w-0 space-y-0.5">
                        <span className="font-medium text-[#0c0e14]">{item.recipient_email}</span>
                        {item.last_error && (
                          <p className="truncate text-xs text-red-500">{item.last_error}</p>
                        )}
                        {/* Suppressed explanation */}
                        {item.delivery_event === "email.suppressed" && (
                          <p className="text-[11px] text-red-500/80">Адресът е в suppression list (спам сигнал или bounce)</p>
                        )}
                        {item.delivery_event === "email.bounced" && (
                          <p className="text-[11px] text-orange-500/80">Имейл адресът не съществува или е недостъпен</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        {/* Delivery badge — most informative signal from Resend */}
                        {item.delivery_event ? (
                          <div className="flex justify-end">
                            <DeliveryBadge event={item.delivery_event} />
                          </div>
                        ) : (
                          <p className={`text-xs font-semibold ${isFailed ? "text-red-600" : isPending ? "text-amber-600" : "text-emerald-700"}`}>
                            {isFailed ? "Грешка" : isPending ? "В опашка" : "Изпратен"}
                          </p>
                        )}
                        <p className="text-[11px] text-black/40">{dateStr}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {publishedFestivals.length === 0 && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Организаторът няма публикувани фестивали с slug.
            </p>
          )}

          {errorMsg && <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errorMsg}</p>}
          {status === "sent" && <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">✓ Имейлът е поставен в опашката.</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-black/[0.08] px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-black/[0.12] px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/[0.03]">
            Затвори
          </button>
          {status !== "sent" && (
            <button
              onClick={handleSend}
              disabled={status === "sending"}
              className="rounded-xl bg-[#7c2d12] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6b2510] disabled:opacity-60"
            >
              {status === "sending" ? "Изпращане…" : "Изпрати имейл"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
