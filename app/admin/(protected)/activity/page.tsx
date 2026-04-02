import Link from "next/link";
import { redirect } from "next/navigation";
import { formatAuditDetailsPreview, sanitizeAuditDetailsForDisplay } from "@/lib/admin/auditLogDetailsFormat";
import { getAdminContext } from "@/lib/admin/isAdmin";
import {
  ADMIN_AUDIT_LOGS_PER_PAGE,
  type AdminAuditLogRow,
  queryAdminAuditLogs,
} from "@/lib/admin/queryAdminAuditLogs";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function buildQueryString(params: {
  action: string;
  entity_type: string;
  actor_user_id: string;
  date_from: string;
  date_to: string;
  page: number;
}) {
  const sp = new URLSearchParams();
  if (params.action.trim()) sp.set("action", params.action.trim());
  if (params.entity_type.trim()) sp.set("entity_type", params.entity_type.trim());
  if (params.actor_user_id.trim()) sp.set("actor_user_id", params.actor_user_id.trim());
  if (params.date_from.trim()) sp.set("date_from", params.date_from.trim());
  if (params.date_to.trim()) sp.set("date_to", params.date_to.trim());
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

function shortUuid(id: string | null): string {
  if (!id) return "—";
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`;
}

function truncateRoute(route: string | null, max = 52): string {
  if (!route) return "—";
  return route.length <= max ? route : `${route.slice(0, max)}…`;
}

function actionBadgeClass(action: string): string {
  if (action.startsWith("pending_festival.")) return "bg-sky-100 text-sky-950 ring-1 ring-sky-200/90";
  if (action.startsWith("festival.")) return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90";
  if (action.startsWith("organizer.")) return "bg-violet-100 text-violet-950 ring-1 ring-violet-200/90";
  if (action.startsWith("ingest_job.")) return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90";
  if (action.startsWith("claim.")) return "bg-rose-100 text-rose-950 ring-1 ring-rose-200/90";
  if (action.startsWith("discovery_source.")) return "bg-cyan-100 text-cyan-950 ring-1 ring-cyan-200/90";
  return "bg-black/[0.06] text-black/80 ring-1 ring-black/[0.1]";
}

function statusBadge(status: string): { text: string; className: string } {
  const s = status.toLowerCase();
  if (s === "success" || s === "ok") {
    return { text: "OK", className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90" };
  }
  if (s === "failure" || s === "error" || s === "failed") {
    return { text: "Грешка", className: "bg-red-100 text-red-950 ring-1 ring-red-200/90" };
  }
  return { text: status || "—", className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]" };
}

function AuditRow({
  row,
  actorLabel,
}: {
  row: AdminAuditLogRow;
  actorLabel: string;
}) {
  const preview = formatAuditDetailsPreview(row.details);
  const safeJson = sanitizeAuditDetailsForDisplay(row.details);
  const jsonStr = JSON.stringify(safeJson, null, 2);
  const st = statusBadge(row.status);

  return (
    <tr className="border-t border-black/[0.06] align-top">
      <td className="px-4 py-3 text-black/75 whitespace-nowrap">
        {new Date(row.created_at).toLocaleString("bg-BG", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex max-w-[220px] break-words rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${actionBadgeClass(row.action)}`}
        >
          {row.action}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-[#0c0e14]">{row.entity_type}</div>
        <div className="font-mono text-xs text-black/50">{shortUuid(row.entity_id)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-black/85">{actorLabel}</div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${st.className}`}
        >
          {st.text}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-black/65">
        <div className="font-mono">{truncateRoute(row.route)}</div>
        {row.method ? (
          <span className="mt-0.5 inline-block rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/55">
            {row.method}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs text-black/70">
        {preview.chips.length > 0 ? (
          <div className="mb-1 flex flex-wrap gap-1">
            {preview.chips.map((c, i) => (
              <span
                key={`${row.id}-chip-${i}`}
                className="inline-flex max-w-[140px] truncate rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-black/70"
                title={c}
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}
        {preview.summaryLine ? <p className="text-[11px] leading-snug text-black/65">{preview.summaryLine}</p> : null}
        {!preview.chips.length && !preview.summaryLine ? (
          <span className="text-black/40">—</span>
        ) : null}
        {Object.keys(row.details).length > 0 ? (
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45 hover:text-black/70">
              Пълни детайли
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/[0.03] p-2 font-mono text-[10px] leading-relaxed text-black/80">
              {jsonStr}
            </pre>
          </details>
        ) : null}
      </td>
    </tr>
  );
}

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const action = asString(params.action);
  const entity_type = asString(params.entity_type);
  const actor_user_id = asString(params.actor_user_id);
  const date_from = asString(params.date_from);
  const date_to = asString(params.date_to);
  const pageRaw = asString(params.page);
  const page = Math.max(1, Number.parseInt(pageRaw || "1", 10) || 1);

  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/activity");
  }

  const filterState = { action, entity_type, actor_user_id, date_from, date_to };

  const result = await queryAdminAuditLogs({
    page,
    action,
    entity_type,
    actor_user_id,
    date_from,
    date_to,
  });

  const { rows, actorDisplayNames, total, error } = result;
  const perPage = ADMIN_AUDIT_LOGS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total > 0 && page > totalPages) {
    redirect(`/admin/activity?${buildQueryString({ ...filterState, page: totalPages })}`);
  }
  const currentPage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  const prevQs =
    currentPage > 1 ? buildQueryString({ ...filterState, page: currentPage - 1 }) : "";
  const nextQs =
    currentPage < totalPages ? buildQueryString({ ...filterState, page: currentPage + 1 }) : "";

  function actorCell(row: AdminAuditLogRow): string {
    if (!row.actor_user_id) return "—";
    const name = actorDisplayNames.get(row.actor_user_id);
    if (name?.trim()) return `${name.trim()} · ${shortUuid(row.actor_user_id)}`;
    return shortUuid(row.actor_user_id);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight">Админ активност</h1>
        <p className="mt-1 text-sm text-black/65">
          Преглед на записаните административни действия (само четене). Без чувствителни данни в обобщенията.
        </p>

        <form className="mt-4 space-y-3" method="get">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:items-end">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Действие
              <input
                name="action"
                defaultValue={action}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm font-mono"
                placeholder="напр. festival.updated"
                autoComplete="off"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Тип обект
              <input
                name="entity_type"
                defaultValue={entity_type}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
                placeholder="напр. festival"
                autoComplete="off"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Актьор (user id)
              <input
                name="actor_user_id"
                defaultValue={actor_user_id}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-mono text-sm"
                placeholder="UUID"
                autoComplete="off"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              От дата
              <input
                name="date_from"
                type="date"
                defaultValue={date_from}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              До дата
              <input
                name="date_to"
                type="date"
                defaultValue={date_to}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
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
              href="/admin/activity"
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              Нулирай
            </Link>
          </div>
        </form>
      </div>

      {error ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 text-sm text-[#b13a1a]">
          {error}
        </div>
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
              <table className="min-w-[960px] w-full text-sm">
                <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
                  <tr>
                    <th className="px-4 py-3">Време</th>
                    <th className="px-4 py-3">Действие</th>
                    <th className="px-4 py-3">Обект</th>
                    <th className="px-4 py-3">Актьор</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3">Маршрут</th>
                    <th className="px-4 py-3 min-w-[200px]">Детайли</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <AuditRow key={row.id} row={row} actorLabel={actorCell(row)} />
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-black/55">
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
                    href={`/admin/activity?${prevQs}`}
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
                    href={`/admin/activity?${nextQs}`}
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
