import Link from "next/link";
import { redirect } from "next/navigation";
import {
  emailDeliveryStatusBadgeClass,
  emailJobCategoryLabel,
  emailJobStatusBadgeClass,
  formatAdminDateTime,
  parseEmailJobKindPreset,
} from "@/lib/admin/emailJobAdminDisplay";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAdminEmailJobsSummary, queryAdminEmailJobsList } from "@/lib/admin/queryAdminEmailJobs";
import { EMAIL_JOB_TYPES } from "@/lib/email/emailJobTypes";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function buildQueryString(params: {
  status: string;
  delivery_status: string;
  type: string;
  kind: string;
  q: string;
  page: number;
}) {
  const sp = new URLSearchParams();
  if (params.status.trim()) sp.set("status", params.status.trim());
  if (params.delivery_status.trim()) sp.set("delivery_status", params.delivery_status.trim());
  if (params.type.trim()) sp.set("type", params.type.trim());
  if (params.kind.trim()) sp.set("kind", params.kind.trim());
  if (params.q.trim()) sp.set("q", params.q.trim());
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

const STATUS_OPTIONS = ["", "pending", "processing", "sent", "failed"] as const;
const DELIVERY_OPTIONS = ["", "delivered", "bounced", "failed", "complained", "delayed", "accepted", "suppressed"] as const;

export default async function AdminEmailJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = asString(params.status);
  const delivery_status = asString(params.delivery_status);
  const type = asString(params.type);
  const kindRaw = asString(params.kind);
  const q = asString(params.q);
  const pageRaw = asString(params.page);
  const page = Math.max(1, Number.parseInt(pageRaw || "1", 10) || 1);
  const kind = parseEmailJobKindPreset(kindRaw);

  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/email-jobs");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
          Липсва <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> — прегледът на имейл опашката изисква service role на сървъра.
        </div>
      </div>
    );
  }

  const filterState = { status, delivery_status, type, kind: kindRaw, q };

  const [listResult, summaryResult] = await Promise.all([
    queryAdminEmailJobsList({
      page,
      status,
      delivery_status,
      type,
      kind,
      q,
    }),
    fetchAdminEmailJobsSummary(adminClient),
  ]);

  const { rows, total, error, perPage } = listResult;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total > 0 && page > totalPages) {
    redirect(`/admin/email-jobs?${buildQueryString({ ...filterState, page: totalPages })}`);
  }
  const currentPage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  const prevQs = currentPage > 1 ? buildQueryString({ ...filterState, page: currentPage - 1 }) : "";
  const nextQs = currentPage < totalPages ? buildQueryString({ ...filterState, page: currentPage + 1 }) : "";

  const summary = summaryResult.summary;
  const summaryErr = summaryResult.error;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight">Имейл опашка</h1>
        <p className="mt-1 text-sm text-black/65">
          Оперативен преглед на <span className="font-mono">email_jobs</span> и доставка през Resend — не е аналитичен дашборд.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin" className="font-semibold text-[#0c0e14] hover:underline">
            ← Табло
          </Link>
        </div>

        <form className="mt-5 space-y-3" method="get">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:items-end">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Статус опашка
              <select
                name="status"
                defaultValue={status}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Всички</option>
                {STATUS_OPTIONS.filter(Boolean).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Доставка (webhook)
              <select
                name="delivery_status"
                defaultValue={delivery_status}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Всички</option>
                {DELIVERY_OPTIONS.filter(Boolean).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Тип <span className="font-normal normal-case text-black/40">(raw)</span>
              <select
                name="type"
                defaultValue={type}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-mono text-xs"
              >
                <option value="">Всички</option>
                {EMAIL_JOB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Група
              <select
                name="kind"
                defaultValue={kindRaw}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">—</option>
                <option value="reminder">Напомняния</option>
                <option value="organizer">Организаторски</option>
                <option value="admin_alert">Админ алерти</option>
              </select>
            </label>
            <label className="col-span-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50 sm:col-span-2 lg:col-span-2">
              Търсене
              <input
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
                placeholder="Имейл, subject, тип, provider id…"
                autoComplete="off"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Приложи
            </button>
            <Link
              href="/admin/email-jobs"
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              Нулирай
            </Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/[0.06] pt-4 text-xs text-black/55">
          <span className="font-semibold uppercase tracking-[0.1em] text-black/45">Бързи:</span>
          <Link className="font-medium text-[#0c0e14] hover:underline" href="/admin/email-jobs?status=pending">
            В изчакване
          </Link>
          <Link className="font-medium text-[#0c0e14] hover:underline" href="/admin/email-jobs?status=failed">
            Провалени (опашка)
          </Link>
          <Link className="font-medium text-[#0c0e14] hover:underline" href="/admin/email-jobs?delivery_status=bounced">
            Bounce
          </Link>
          <Link className="font-medium text-[#0c0e14] hover:underline" href="/admin/email-jobs?kind=reminder">
            Напомняния
          </Link>
          <Link className="font-medium text-[#0c0e14] hover:underline" href="/admin/email-jobs?kind=organizer">
            Орг. имейли
          </Link>
        </div>
      </div>

      {summaryErr ? (
        <p className="text-xs text-amber-800">Обобщението не се зареди: {summaryErr}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Pending</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{summary.pending}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Failed (опашка)</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{summary.failed}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Bounced</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{summary.bounced}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Delivered</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{summary.delivered}</p>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(12,14,20,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Изпратени 24ч</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0c0e14]">{summary.sentLast24h}</p>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 text-sm text-[#b13a1a]">{error}</div>
      ) : (
        <>
          <p className="text-sm text-black/60">
            {total === 0 ? (
              "Няма записи за избраните филтри."
            ) : (
              <>
                Показани {from}–{to} от {total}
              </>
            )}
          </p>

          <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
                  <tr>
                    <th className="px-4 py-3">Създаден</th>
                    <th className="px-4 py-3">Тип</th>
                    <th className="px-4 py-3">Получател</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3">Доставка</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Изпратен</th>
                    <th className="px-4 py-3 min-w-[140px]">Последно събитие</th>
                    <th className="px-4 py-3">Детайл</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cat = emailJobCategoryLabel(row.type);
                    return (
                      <tr key={row.id} className="border-t border-black/[0.06] align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-black/75">{formatAdminDateTime(row.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-[#0c0e14]">{row.type}</div>
                          {cat ? (
                            <span className="mt-1 inline-flex rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-950 ring-1 ring-violet-200/80">
                              {cat}
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-[200px] px-4 py-3 break-all text-black/85">{row.recipient_email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${emailJobStatusBadgeClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.delivery_status ? (
                            <span
                              className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${emailDeliveryStatusBadgeClass(row.delivery_status)}`}
                            >
                              {row.delivery_status}
                            </span>
                          ) : (
                            <span className="text-black/40">—</span>
                          )}
                          {row.provider ? (
                            <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-black/45">
                              {row.provider}
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-[min(240px,40vw)] px-4 py-3 text-xs text-black/70">
                          {row.subject?.trim() ? (
                            <span className="line-clamp-2" title={row.subject}>
                              {row.subject}
                            </span>
                          ) : (
                            <span className="text-black/40">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-black/70">
                          {row.sent_at ? formatAdminDateTime(row.sent_at) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-black/65">
                          {row.last_event_type ? (
                            <>
                              <span className="font-mono text-[11px]">{row.last_event_type}</span>
                              {row.last_event_at ? (
                                <div className="mt-0.5 text-[10px] text-black/45">{formatAdminDateTime(row.last_event_at)}</div>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/email-jobs/${row.id}`}
                            className="text-xs font-semibold text-[#0c0e14] hover:underline"
                          >
                            Отвори
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-black/55">
                        Няма редове на тази страница.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-black/50">
                Страница {currentPage} от {totalPages}
              </p>
              <div className="flex flex-wrap gap-2">
                {prevQs ? (
                  <Link
                    href={`/admin/email-jobs?${prevQs}`}
                    className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                  >
                    Предишна
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-black/35">
                    Предишна
                  </span>
                )}
                {nextQs ? (
                  <Link
                    href={`/admin/email-jobs?${nextQs}`}
                    className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                  >
                    Следваща
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-black/35">
                    Следваща
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
