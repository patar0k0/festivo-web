import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  emailDeliveryStatusBadgeClass,
  emailJobCategoryLabel,
  emailJobStatusBadgeClass,
  emailWebhookEventBadgeClass,
  formatAdminDateTime,
  maskSensitiveJsonForAdmin,
} from "@/lib/admin/emailJobAdminDisplay";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminEmailEventsForJob, fetchAdminEmailJobDetail } from "@/lib/admin/queryAdminEmailJobs";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function AdminEmailJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/email-jobs/${id}`);
  }

  try {
    createSupabaseAdmin();
  } catch {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Липсва <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>.
      </div>
    );
  }

  const { row, error } = await fetchAdminEmailJobDetail(id);
  if (error) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error}</div>
    );
  }
  if (!row) {
    notFound();
  }

  const { rows: events, error: evErr } = await fetchAdminEmailEventsForJob(row.id);

  const maskedPayload = maskSensitiveJsonForAdmin(row.payload);
  const payloadStr = JSON.stringify(maskedPayload, null, 2);
  const category = emailJobCategoryLabel(row.type);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Имейл job</p>
            <h1 className="mt-1 font-mono text-lg font-bold text-[#0c0e14]">{row.id}</h1>
            {category ? (
              <span className="mt-2 inline-flex rounded bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-950 ring-1 ring-violet-200/80">
                {category}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/email-jobs"
              className="rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
            >
              ← Към списъка
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Тип (raw)</dt>
            <dd className="mt-0.5 font-mono text-[#0c0e14]">{row.type}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Получател</dt>
            <dd className="mt-0.5 break-all text-black/85">{row.recipient_email}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Статус опашка</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${emailJobStatusBadgeClass(row.status)}`}
              >
                {row.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Доставка</dt>
            <dd className="mt-1">
              {row.delivery_status ? (
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${emailDeliveryStatusBadgeClass(row.delivery_status)}`}
                >
                  {row.delivery_status}
                </span>
              ) : (
                <span className="text-black/40">—</span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Subject</dt>
            <dd className="mt-0.5 text-black/85">{row.subject?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Provider</dt>
            <dd className="mt-0.5 font-mono text-black/80">{row.provider ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Provider message id</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-black/75">{row.provider_message_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Създаден</dt>
            <dd className="mt-0.5 text-black/80">{formatAdminDateTime(row.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Изпратен</dt>
            <dd className="mt-0.5 text-black/80">{row.sent_at ? formatAdminDateTime(row.sent_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Delivered at</dt>
            <dd className="mt-0.5 text-black/80">{row.delivered_at ? formatAdminDateTime(row.delivered_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Bounced at</dt>
            <dd className="mt-0.5 text-black/80">{row.bounced_at ? formatAdminDateTime(row.bounced_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Последно събитие</dt>
            <dd className="mt-0.5 font-mono text-xs text-black/75">
              {row.last_event_type ?? "—"}
              {row.last_event_at ? (
                <span className="mt-0.5 block text-black/50">{formatAdminDateTime(row.last_event_at)}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Locale</dt>
            <dd className="mt-0.5 font-mono">{row.locale}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Опити</dt>
            <dd className="mt-0.5 tabular-nums text-black/80">
              {row.attempts} / {row.max_attempts}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Dedupe key</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-black/70">{row.dedupe_key ?? "—"}</dd>
          </div>
          {row.recipient_user_id ? (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Recipient user id</dt>
              <dd className="mt-0.5 font-mono text-xs text-black/70">{row.recipient_user_id}</dd>
            </div>
          ) : null}
        </dl>

        {row.last_error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-900/80">Последна грешка</p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-red-950">{row.last_error}</pre>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-5">
        <h2 className="text-sm font-semibold text-[#0c0e14]">Payload (маскиран)</h2>
        <p className="mt-1 text-xs text-black/50">
          Полета с чувствителни имена (token, unsubscribe, …) се заменят с <span className="font-mono">[redacted]</span>.
        </p>
        <pre className="mt-3 max-h-[min(70vh,32rem)] overflow-auto rounded-lg bg-black/[0.03] p-3 font-mono text-[11px] leading-relaxed text-black/85">
          {payloadStr}
        </pre>
      </div>

      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-5">
        <h2 className="text-sm font-semibold text-[#0c0e14]">Събития (webhook timeline)</h2>
        <p className="mt-1 text-xs text-black/50">Хронологично по <span className="font-mono">occurred_at</span> (най-старо → най-ново).</p>
        {evErr ? <p className="mt-2 text-sm text-[#b13a1a]">{evErr}</p> : null}
        {!evErr && events.length === 0 ? (
          <p className="mt-4 text-sm text-black/55">Няма записи в email_events за този job (или webhook още не е пристигнал).</p>
        ) : null}
        {!evErr && events.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {events.map((ev) => {
              const maskedEv = maskSensitiveJsonForAdmin(ev.event_payload);
              const payloadJson = JSON.stringify(maskedEv, null, 2);
              return (
                <li
                  key={ev.id}
                  className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex max-w-full break-all rounded px-2 py-0.5 text-[11px] font-semibold ${emailWebhookEventBadgeClass(ev.event_type)}`}
                    >
                      {ev.event_type}
                    </span>
                    <span className="text-xs text-black/60">{formatAdminDateTime(ev.occurred_at)}</span>
                  </div>
                  {ev.provider_message_id ? (
                    <p className="mt-1 font-mono text-[10px] text-black/45 break-all">{ev.provider_message_id}</p>
                  ) : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45 hover:text-black/70">
                      Raw payload (маскиран)
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/[0.04] p-2 font-mono text-[10px] leading-relaxed text-black/80">
                      {payloadJson}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
