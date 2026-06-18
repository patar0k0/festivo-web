"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminEntityPageShell,
  AdminFieldSection,
  AdminSummaryStrip,
  ADMIN_ENTITY_SECTION,
  ADMIN_ENTITY_CONTROL_CLASS,
  buildStandardSummaryStripItems,
} from "@/components/admin/entity";
import { ADMIN_FIELD_LABEL } from "@/lib/admin/entitySchema";

type IngestJobRow = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  source_type: string;
  source_url: string;
  pending_festival_id: string | null;
  pending_status: "pending" | "approved" | "rejected" | null;
  published_festival_id: string | null;
  moderation_action: "open_pending" | "open_festival" | "no_pending_record" | "rejected" | "approved_without_festival" | "in_progress";
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  fb_browser_context: "authenticated" | "anonymous" | null;
  submission_source: string;
};

type IngestJobsPanelProps = {
  rows: IngestJobRow[];
  page: number;
  pageSize: number;
  total: number;
};

type SourceKind = "telegram" | "facebook" | "research" | "discovery" | "other";

const SOURCE_LABEL: Record<SourceKind, string> = {
  telegram: "Telegram",
  facebook: "Facebook",
  research: "Research",
  discovery: "Discovery",
  other: "—",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "В опашка", className: "bg-black/[0.05] text-black/65" },
  processing: { label: "Обработва се", className: "bg-[#2563eb]/10 text-[#1d4ed8]" },
  failed: { label: "Грешка", className: "bg-[#ff4c1f]/10 text-[#b13a1a]" },
  pending_review: { label: "За преглед", className: "bg-[#d97706]/12 text-[#b45309]" },
  published: { label: "Публикуван", className: "bg-[#18a05e]/12 text-[#0e7a45]" },
  rejected: { label: "Отхвърлен", className: "bg-black/[0.06] text-black/55" },
  approved: { label: "Одобрен", className: "bg-[#18a05e]/12 text-[#0e7a45]" },
  no_pending: { label: "Няма запис", className: "bg-black/[0.05] text-black/55" },
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Всички" },
  { value: "pending", label: "В опашка" },
  { value: "processing", label: "Обработва се" },
  { value: "failed", label: "Грешка" },
  { value: "pending_review", label: "За преглед" },
  { value: "published", label: "Публикуван" },
  { value: "rejected", label: "Отхвърлен" },
];

const SOURCE_FILTERS: Array<{ value: "all" | SourceKind; label: string }> = [
  { value: "all", label: "Всички" },
  { value: "facebook", label: "Facebook" },
  { value: "telegram", label: "Telegram" },
  { value: "research", label: "Research" },
  { value: "discovery", label: "Discovery" },
];

function workflowStateOf(row: IngestJobRow): string {
  if (row.status !== "done") return row.status; // pending | processing | failed
  switch (row.moderation_action) {
    case "open_pending":
      return "pending_review";
    case "open_festival":
      return "published";
    case "rejected":
      return "rejected";
    case "approved_without_festival":
      return "approved";
    case "no_pending_record":
      return "no_pending";
    default:
      return row.status;
  }
}

function statusBadge(state: string) {
  return STATUS_BADGE[state] ?? { label: state, className: "bg-black/[0.05] text-black/65" };
}

function sourceKindOf(row: IngestJobRow): SourceKind {
  if (row.submission_source === "telegram") return "telegram";
  if (row.source_type === "research") return "research";
  if (row.source_type === "discovery") return "discovery";
  if (row.source_type === "facebook_event") return "facebook";
  return "other";
}

function fbBrowserContextLabel(row: IngestJobRow): string {
  if (row.source_type === "research") return "—";
  if (row.status === "pending") return "—";
  if (row.status === "processing" && row.fb_browser_context == null) return "…";
  if (row.fb_browser_context === "authenticated") return "С FB сесия";
  if (row.fb_browser_context === "anonymous") return "Анонимно";
  return "—";
}

type RowAction = "retry" | "delete";

function isValidFacebookEventUrl(input: string) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname.toLowerCase().includes("facebook.com") && url.pathname.toLowerCase().includes("/events/");
  } catch {
    return false;
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export default function IngestJobsPanel({ rows, page, pageSize, total }: IngestJobsPanelProps) {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<RowAction | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceKind>("all");
  const [search, setSearch] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!isValidFacebookEventUrl(sourceUrl)) {
      setError("Въведи валиден линк към Facebook събитие (facebook.com/events/...).");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/admin/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source_url: sourceUrl }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно добавяне в опашката."));
      }

      const payload = (await response.json()) as { ok: true; id: string };
      setMessage(`Добавено успешно. Job ID: ${payload.id}`);
      setSourceUrl("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Неочаквана грешка при добавяне.");
    } finally {
      setBusy(false);
    }
  };

  const retryJob = async (row: IngestJobRow) => {
    if (busyRowId) return;

    setMessage("");
    setError("");
    setBusyRowId(row.id);
    setBusyAction("retry");

    try {
      const response = await fetch(`/admin/api/ingest-jobs/${row.id}`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешен повторен опит."));
      }

      setMessage(`Job ${row.id} е нулиран и пуснат за повторна обработка.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Неочаквана грешка при повторен опит.");
    } finally {
      setBusyRowId(null);
      setBusyAction(null);
    }
  };

  const deleteJob = async (row: IngestJobRow) => {
    if (busyRowId) return;
    if (!window.confirm("Да премахна ли този job от опашката?")) return;

    setMessage("");
    setError("");
    setBusyRowId(row.id);
    setBusyAction("delete");

    try {
      const response = await fetch(`/admin/api/ingest-jobs/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно премахване."));
      }

      setMessage(`Job ${row.id} е премахнат.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Неочаквана грешка при премахване.");
    } finally {
      setBusyRowId(null);
      setBusyAction(null);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && workflowStateOf(row) !== statusFilter) return false;
      if (sourceFilter !== "all" && sourceKindOf(row) !== sourceFilter) return false;
      if (q && !row.source_url.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, sourceFilter, search]);

  const summaryItems = useMemo(() => {
    const pendingReview = rows.filter((r) => r.moderation_action === "open_pending").length;
    const inFlight = rows.filter((r) => r.status === "pending" || r.status === "processing").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const statusLine = [
      inFlight > 0 ? `${inFlight} в процес` : null,
      failed > 0 ? `${failed} с грешка` : null,
      pendingReview > 0 ? `${pendingReview} за преглед` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return buildStandardSummaryStripItems({
      status: statusLine || "Опашката е спокойна",
      sourceLine: "ingest_jobs",
      city: "—",
      startDate: "—",
      organizer: "—",
      contextLabel: ADMIN_FIELD_LABEL.queue,
      contextValue: `${rows.length} ${rows.length === 1 ? "job" : "job-а"} на тази страница`,
    });
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const chipBase = "rounded-full px-3 py-1 text-xs font-semibold transition";
  const chipOn = "bg-[#0c0e14] text-white";
  const chipOff = "bg-black/[0.04] text-black/60 hover:bg-black/[0.08]";

  return (
    <AdminEntityPageShell>
      <AdminSummaryStrip
        title="Опашка за добавяне"
        eyebrow="Админ · Ingestion"
        items={summaryItems}
        actions={
          <Link
            href="/admin/research"
            className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.03]"
          >
            Research фестивал
          </Link>
        }
      />

      <AdminFieldSection
        title="Добави Facebook събитие"
        description={'Facebook събитията се свалят от worker-а. Research редовете ползват source_type=research (без браузър). Discovery редовете ползват source_type=discovery. „С FB сесия“ означава, че worker-ът е ползвал запазен Facebook вход (FB_STORAGE_STATE_B64). Линкове може да се подават и през Telegram бота.'}
        variant={ADMIN_ENTITY_SECTION.linksSources.variant}
      >
        <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Линк към Facebook събитие
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://www.facebook.com/events/..."
              className={`mt-1 ${ADMIN_ENTITY_CONTROL_CLASS}`}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-8 rounded-lg bg-[#0c0e14] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Добавям..." : "Добави в опашката"}
          </button>
        </form>

        {message ? <p className="mt-2 rounded-lg bg-[#18a05e]/10 px-2.5 py-1.5 text-sm text-[#0e7a45]">{message}</p> : null}
        {error ? <p className="mt-2 rounded-lg bg-[#ff4c1f]/10 px-2.5 py-1.5 text-sm text-[#b13a1a]">{error}</p> : null}
      </AdminFieldSection>

      <AdminFieldSection
        title={ADMIN_ENTITY_SECTION.systemMeta.title}
        description="Жизнен цикъл на job-а, браузър контекст на worker-а и връзки към записите за модерация. Филтрите и търсенето важат за текущата страница."
        variant={ADMIN_ENTITY_SECTION.systemMeta.variant}
      >
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Статус</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`${chipBase} ${statusFilter === f.value ? chipOn : chipOff}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Източник</span>
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setSourceFilter(f.value)}
                className={`${chipBase} ${sourceFilter === f.value ? chipOn : chipOff}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Търси по URL…"
            className={ADMIN_ENTITY_CONTROL_CLASS}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-black/[0.06] bg-white/80">
          <table className="min-w-full divide-y divide-black/[0.08] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
              <tr>
                <th className="px-2.5 py-2">Статус</th>
                <th className="px-2.5 py-2">Източник</th>
                <th className="px-2.5 py-2">FB браузър</th>
                <th className="px-2.5 py-2">URL</th>
                <th className="px-2.5 py-2">Създаден</th>
                <th className="px-2.5 py-2">Започнат</th>
                <th className="px-2.5 py-2">Завършен</th>
                <th className="px-2.5 py-2">Грешка</th>
                <th className="px-2.5 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const rowBusy = busyRowId === row.id;
                  const canRetry = row.status === "failed";

                  const canReviewPending = row.status === "done" && row.moderation_action === "open_pending" && !!row.pending_festival_id;
                  const canOpenFestival = row.status === "done" && row.moderation_action === "open_festival" && !!row.published_festival_id;
                  const showNoPendingRecord = row.status === "done" && row.moderation_action === "no_pending_record";
                  const showRejected = row.status === "done" && row.moderation_action === "rejected";
                  const showApprovedNoLink = row.status === "done" && row.moderation_action === "approved_without_festival";

                  const badge = statusBadge(workflowStateOf(row));
                  const sourceKind = sourceKindOf(row);

                  return (
                    <tr key={row.id} className="hover:bg-black/[0.02]">
                      <td className="px-2.5 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-black/60">{SOURCE_LABEL[sourceKind]}</span>
                          {sourceKind === "telegram" ? (
                            <span className="inline-flex rounded-full bg-[#2563eb]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                              Telegram
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 text-black/65" title="Playwright: логнат FB профил или анонимно">
                        {fbBrowserContextLabel(row)}
                      </td>
                      <td className="px-2.5 py-2 text-black/75">
                        <a href={row.source_url} target="_blank" rel="noreferrer" className="break-all underline decoration-black/25 underline-offset-2">
                          {row.source_url}
                        </a>
                      </td>
                      <td className="px-2.5 py-2 text-black/65">{new Date(row.created_at).toLocaleString("bg-BG")}</td>
                      <td className="px-2.5 py-2 text-black/65">{row.started_at ? new Date(row.started_at).toLocaleString("bg-BG") : "-"}</td>
                      <td className="px-2.5 py-2 text-black/65">{row.finished_at ? new Date(row.finished_at).toLocaleString("bg-BG") : "-"}</td>
                      <td className="px-2.5 py-2 text-[#b13a1a]">{row.error ?? "-"}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-2 whitespace-nowrap">
                          <a
                            href={row.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
                          >
                            Отвори URL
                          </a>
                          {canReviewPending ? (
                            <Link
                              href={`/admin/pending-festivals/${row.pending_festival_id}`}
                              className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
                            >
                              Отвори чакащ
                            </Link>
                          ) : null}
                          {canOpenFestival && row.published_festival_id ? (
                            <Link
                              href={`/admin/festivals/${row.published_festival_id}`}
                              className="inline-flex rounded-lg border border-[#18a05e]/30 bg-[#18a05e]/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#0e7a45] hover:bg-[#18a05e]/15"
                            >
                              Отвори фестивал
                            </Link>
                          ) : null}
                          {showNoPendingRecord ? <span className="text-xs text-black/45">Няма запис</span> : null}
                          {showRejected ? <span className="text-xs text-black/45">Отхвърлен при преглед</span> : null}
                          {showApprovedNoLink ? <span className="text-xs text-black/45">Одобрен</span> : null}
                          <button
                            type="button"
                            disabled={!canRetry || rowBusy}
                            onClick={() => retryJob(row)}
                            className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {rowBusy && busyAction === "retry" ? "Опитвам..." : "Повтори"}
                          </button>
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => deleteJob(row)}
                            className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#b13a1a] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {rowBusy && busyAction === "delete" ? "Премахвам..." : "Премахни"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-black/60">
                    {rows.length ? "Няма резултати за този филтър." : "Все още няма job-ове в опашката."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-black/55">
          <span>
            Страница {page} от {totalPages} · {total} общо
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/admin/ingest?page=${page - 1}`}
                className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
              >
                ← Назад
              </Link>
            ) : (
              <span className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] text-black/30">
                ← Назад
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`/admin/ingest?page=${page + 1}`}
                className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
              >
                Напред →
              </Link>
            ) : (
              <span className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] text-black/30">
                Напред →
              </span>
            )}
          </div>
        </div>
      </AdminFieldSection>
    </AdminEntityPageShell>
  );
}
