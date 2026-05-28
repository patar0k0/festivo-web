import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow, isValid as isDateValid, parseISO } from "date-fns";
import { bg } from "date-fns/locale";
import OrganizerSubmissionMonetizationBadge from "@/components/organizer/OrganizerSubmissionMonetizationBadge";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import type { OrganizerVipStatusRow } from "@/lib/monetization";
import {
  ORGANIZER_PORTAL_FESTIVAL_PROMOTION_KEYS,
  ORGANIZER_PORTAL_ORGANIZER_VIP_FIELDS,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type OrganizerPortalListRow = OrganizerVipStatusRow & { id: string; name: string | null };

type SubmissionRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  organizer_id: string | null;
  slug: string | null;
};

// Display date that respects local-only date strings (YYYY-MM-DD).
// `new Date('2026-06-03')` is interpreted as UTC midnight → can show "2 юни" in
// Sofia (UTC+3). Parsing without timezone keeps the date stable in bg locale.
function formatDate(raw: string | null): string | null {
  if (!raw) return null;
  // YYYY-MM-DD → render without TZ conversion via Date(year, month-1, day)
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!isDateValid(d)) return null;
    return format(d, "d MMM yyyy", { locale: bg });
  }
  const d = parseISO(raw);
  return isDateValid(d) ? format(d, "d MMM yyyy", { locale: bg }) : null;
}

function formatDateRange(start: string | null, end: string | null): string {
  const s = formatDate(start);
  if (!s) return "Без дата";
  const e = formatDate(end);
  if (!e || e === s) return s;
  return `${s} – ${e}`;
}

function statusMeta(status: string): {
  label: string;
  emoji: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case "draft":
      return {
        label: "Чернова",
        emoji: "✏️",
        badgeClass: "border-black/[0.12] bg-white text-black/70",
        dotClass: "bg-black/30",
      };
    case "pending":
      return {
        label: "Чака преглед",
        emoji: "⏳",
        badgeClass: "border-amber-200/80 bg-amber-50/90 text-amber-900",
        dotClass: "bg-amber-500",
      };
    case "approved":
      return {
        label: "Одобрено",
        emoji: "✅",
        badgeClass: "border-emerald-200/80 bg-emerald-50/90 text-emerald-900",
        dotClass: "bg-emerald-500",
      };
    case "rejected":
      return {
        label: "Отхвърлено",
        emoji: "❌",
        badgeClass: "border-red-200/80 bg-red-50/90 text-red-900",
        dotClass: "bg-red-500",
      };
    default:
      return {
        label: status,
        emoji: "•",
        badgeClass: "border-black/10 bg-white text-black/65",
        dotClass: "bg-black/30",
      };
  }
}

export default async function OrganizerSubmissionsPage({
  searchParams,
}: {
  searchParams?: { submitted?: string };
}) {
  const gate = await requireOrganizerOwnerPortalSession("/organizer/submissions");
  if (gate.kind === "redirect") {
    redirect(gate.to);
  }
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-200/55 bg-amber-50/70 px-5 py-6 text-sm text-amber-950/85 shadow-sm">
        Услугата е временно недостъпна. Опитайте по-късно.
      </div>
    );
  }

  const { admin, orgIds } = gate;
  const showSubmittedOk = searchParams?.submitted === "1";

  const { data: orgRows, error: orgErr } =
    orgIds.length > 0
      ? await admin
          .from("organizers")
          .select(ORGANIZER_PORTAL_ORGANIZER_VIP_FIELDS)
          .in("id", orgIds)
          .eq("is_active", true)
      : { data: [] as OrganizerPortalListRow[], error: null as null };

  if (orgErr) {
    throw new Error(orgErr.message);
  }

  const orgNameById = new Map((orgRows ?? []).map((o) => [o.id, o.name ?? ""]));
  const orgById = new Map((orgRows ?? []).map((o) => [o.id, o as OrganizerPortalListRow]));

  const { data: submissions, error: subErr } =
    orgIds.length > 0
      ? await admin
          .from("pending_festivals")
          .select(
            "id,title,status,created_at,submission_source,start_date,end_date,organizer_id,slug",
          )
          .in("organizer_id", orgIds)
          .eq("submission_source", "organizer_portal")
          .order("created_at", { ascending: false })
          .limit(80)
      : {
          data: [] as SubmissionRow[],
          error: null as null,
        };

  if (subErr) {
    throw new Error(subErr.message);
  }

  const { data: festivalPromoRows, error: festErr } =
    orgIds.length > 0
      ? await admin
          .from("festivals")
          .select(ORGANIZER_PORTAL_FESTIVAL_PROMOTION_KEYS)
          .in("organizer_id", orgIds)
      : {
          data: [] as {
            organizer_id: string | null;
            slug: string | null;
            promotion_status: string | null;
            promotion_expires_at: string | null;
          }[],
          error: null as null,
        };

  if (festErr) {
    throw new Error(festErr.message);
  }

  const promotionByOrganizerSlug = new Map<
    string,
    { promotion_status: string | null; promotion_expires_at: string | null }
  >();
  for (const row of festivalPromoRows ?? []) {
    const oid = row.organizer_id;
    const slug = typeof row.slug === "string" ? row.slug : null;
    if (oid && slug) {
      promotionByOrganizerSlug.set(`${oid}|${slug}`, {
        promotion_status: row.promotion_status,
        promotion_expires_at: row.promotion_expires_at,
      });
    }
  }

  const rows = (submissions ?? []) as SubmissionRow[];
  const hasRows = rows.length > 0;

  const counts = {
    total: rows.length,
    draft: rows.filter((r) => r.status === "draft").length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* ── Back link ─────────────────────────────────────── */}
      <Link
        href="/organizer/dashboard"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold uppercase tracking-[0.14em] text-black/55 transition-colors hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
      >
        <span aria-hidden="true">←</span> Назад към таблото
      </Link>

      {/* ── Header card ───────────────────────────────────── */}
      <header className="rounded-2xl border border-amber-200/55 bg-gradient-to-br from-amber-50/55 via-white to-white/95 p-5 shadow-sm ring-1 ring-amber-100/40 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c2d12]">
              Подавания
            </p>
            <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
              Моите подавания
            </h1>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-black/65">
              Преглед на всички подадени фестивали и техния статус. Промените се
              извършват от екипа на Festivo обикновено в рамките на 24–48 часа.
            </p>
          </div>
          <Link
            href="/organizer/festivals/new"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#7c2d12] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
          >
            <span aria-hidden="true">+</span> Добави фестивал
          </Link>
        </div>
      </header>

      {/* ── Success banner (?submitted=1) ────────────────── */}
      {showSubmittedOk ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/85 to-white/95 px-5 py-4 shadow-sm ring-1 ring-emerald-100/50"
        >
          <span className="text-2xl" aria-hidden="true">
            🎉
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-950">
              Подаването е изпратено успешно!
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
              Чака преглед от екипа. Ще получиш имейл при одобрение — обикновено в
              рамките на 24–48 часа в работни дни.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Stats bar (само ако има submissions) ────────── */}
      {hasRows ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Статуси">
          <StatChip
            emoji="✏️"
            label="Чернови"
            count={counts.draft}
            tone="neutral"
          />
          <StatChip
            emoji="⏳"
            label="Чакат"
            count={counts.pending}
            tone="amber"
          />
          <StatChip
            emoji="✅"
            label="Одобрени"
            count={counts.approved}
            tone="emerald"
          />
          <StatChip
            emoji="❌"
            label="Отхвърлени"
            count={counts.rejected}
            tone="red"
          />
        </section>
      ) : null}

      {/* ── Submissions list / empty state ──────────────── */}
      <section className="rounded-2xl border border-black/[0.06] bg-white/95 p-5 shadow-sm md:p-7">
        {!hasRows ? (
          <div className="rounded-xl border border-dashed border-amber-300/60 bg-[#fefcf8] px-5 py-10 text-center">
            <p className="text-4xl" aria-hidden="true">
              🎪
            </p>
            <p className="mt-3 text-base font-semibold text-[#0c0e14]">
              Все още нямаш подадени фестивали
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-black/55">
              След като подадеш фестивал, ще можеш да следиш статуса му и да го
              редактираш докато чака преглед.
            </p>
            <Link
              href="/organizer/festivals/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#7c2d12] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] active:scale-[0.99]"
            >
              Добави първия си фестивал →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
              <p className="text-sm font-semibold text-[#0c0e14]">
                {counts.total} {counts.total === 1 ? "подаване" : "подавания"}
              </p>
              <p className="text-[11px] text-black/45">
                Сортирани по дата на подаване (най-нови първо)
              </p>
            </div>

            <ul className="divide-y divide-black/[0.06]">
              {rows.map((row) => {
                const org = row.organizer_id ? orgById.get(row.organizer_id) ?? null : null;
                const slug =
                  typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : null;
                const festivalPromo =
                  row.status === "approved" && row.organizer_id && slug
                    ? promotionByOrganizerSlug.get(`${row.organizer_id}|${slug}`) ?? null
                    : null;
                const meta = statusMeta(row.status);
                const createdDate = new Date(row.created_at);
                const createdValid = !Number.isNaN(createdDate.getTime());
                const dateRange = formatDateRange(row.start_date, row.end_date);
                const orgName = row.organizer_id
                  ? orgNameById.get(row.organizer_id) ?? null
                  : null;

                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                          />
                          {meta.label}
                        </span>
                        <OrganizerSubmissionMonetizationBadge
                          festival={festivalPromo}
                          organizer={org}
                        />
                      </div>

                      <p className="mt-2 text-sm font-semibold leading-snug text-[#0c0e14] md:text-base">
                        {row.title}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-black/55">
                        {orgName ? (
                          <>
                            <span className="font-medium text-black/65">{orgName}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        ) : null}
                        <span>📅 {dateRange}</span>
                        {createdValid ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <time
                              dateTime={row.created_at}
                              title={format(createdDate, "d MMMM yyyy, HH:mm", { locale: bg })}
                            >
                              подадено{" "}
                              {formatDistanceToNow(createdDate, {
                                addSuffix: true,
                                locale: bg,
                              })}
                            </time>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {row.status === "draft" ? (
                        <>
                          <Link
                            href={`/organizer/festivals/preview/${row.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-black/[0.04]"
                          >
                            👁 Преглед
                          </Link>
                          <Link
                            href={`/organizer/festivals/new?draft=${encodeURIComponent(row.id)}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#7c2d12] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#5c200d]"
                          >
                            ✏️ Продължи
                          </Link>
                        </>
                      ) : null}
                      {row.status === "pending" ? (
                        <Link
                          href={`/organizer/submissions/${row.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-black/[0.04]"
                        >
                          ✏️ Редакция
                        </Link>
                      ) : null}
                      {row.status === "approved" && slug ? (
                        <Link
                          href={`/festivals/${slug}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/70 bg-emerald-50/40 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-50/80"
                        >
                          🔗 Виж публикувания →
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 border-t border-black/[0.04] pt-4 text-[11px] leading-relaxed text-black/45">
              💡 Показват се последните {Math.min(counts.total, 80)} подавания. При
              нужда от по-стари — пиши на{" "}
              <a
                href="mailto:admin@festivo.bg"
                className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
              >
                admin@festivo.bg
              </a>
              .
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StatChip({
  emoji,
  label,
  count,
  tone,
}: {
  emoji: string;
  label: string;
  count: number;
  tone: "neutral" | "amber" | "emerald" | "red";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200/55 bg-gradient-to-br from-emerald-50/40 to-white/95"
      : tone === "amber"
        ? "border-amber-200/55 bg-gradient-to-br from-amber-50/40 to-white/95"
        : tone === "red"
          ? "border-red-200/55 bg-gradient-to-br from-red-50/40 to-white/95"
          : "border-black/[0.06] bg-white/95";

  const valueClass = count > 0 ? "text-[#0c0e14]" : "text-black/30";

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden="true">
          {emoji}
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/55">
          {label}
        </p>
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${valueClass}`}>{count}</p>
    </div>
  );
}
