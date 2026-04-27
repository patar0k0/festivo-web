import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerSubmissionMonetizationBadge from "@/components/organizer/OrganizerSubmissionMonetizationBadge";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import type { OrganizerVipStatusRow } from "@/lib/monetization";
import { ORGANIZER_PORTAL_FESTIVAL_PROMOTION_KEYS, ORGANIZER_PORTAL_ORGANIZER_VIP_FIELDS } from "@/lib/queries";

export const dynamic = "force-dynamic";

type OrganizerPortalListRow = OrganizerVipStatusRow & { id: string; name: string | null };

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "—";
  if (!end || end === start) return start;
  return `${start} – ${end}`;
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
    return <div className="text-sm text-black/60">Услугата е временно недостъпна.</div>;
  }

  const { admin, orgIds } = gate;
  const showSubmittedOk = searchParams?.submitted === "1";

  const { data: orgRows, error: orgErr } =
    orgIds.length > 0
      ? await admin.from("organizers").select(ORGANIZER_PORTAL_ORGANIZER_VIP_FIELDS).in("id", orgIds).eq("is_active", true)
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
          .select("id,title,status,created_at,submission_source,start_date,end_date,organizer_id,slug")
          .in("organizer_id", orgIds)
          .eq("submission_source", "organizer_portal")
          .order("created_at", { ascending: false })
          .limit(80)
      : {
          data: [] as {
            id: string;
            title: string;
            status: string;
            created_at: string;
            start_date: string | null;
            end_date: string | null;
            organizer_id: string | null;
            slug: string | null;
          }[],
          error: null as null,
        };

  if (subErr) {
    throw new Error(subErr.message);
  }

  const { data: festivalPromoRows, error: festErr } =
    orgIds.length > 0
      ? await admin.from("festivals").select(ORGANIZER_PORTAL_FESTIVAL_PROMOTION_KEYS).in("organizer_id", orgIds)
      : { data: [] as { organizer_id: string | null; slug: string | null; promotion_status: string | null; promotion_expires_at: string | null }[], error: null as null };

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <Link href="/organizer/dashboard" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-[#0c0e14]">
          ← Табло
        </Link>
        <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold">Моите подавания</h1>
      </div>

      {showSubmittedOk ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
          Подаването е изпратено успешно и чака преглед от екипа.
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        {!submissions?.length ? (
          <p className="text-sm text-black/60">
            Няма подавания.{" "}
            <Link href="/organizer/festivals/new" className="font-medium underline">
              Подайте фестивал
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {(submissions ?? []).map((row) => {
              const org = row.organizer_id ? (orgById.get(row.organizer_id) ?? null) : null;
              const slug = typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : null;
              const festivalPromo =
                row.status === "approved" && row.organizer_id && slug
                  ? (promotionByOrganizerSlug.get(`${row.organizer_id}|${slug}`) ?? null)
                  : null;

              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-semibold text-[#0c0e14]">{row.title}</p>
                      <div className="shrink-0 sm:ml-3">
                        <OrganizerSubmissionMonetizationBadge festival={festivalPromo} organizer={org} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-black/55">
                      <span className="font-medium text-black/70">
                        {row.organizer_id ? (orgNameById.get(row.organizer_id) ?? "Организатор") : "—"}
                      </span>
                      {" · "}
                      {formatDateRange(row.start_date, row.end_date)}
                      {" · "}
                      {new Date(row.created_at).toLocaleString("bg-BG")}
                    </p>
                    <p className="mt-1 text-xs text-black/50">
                      {row.status === "draft"
                        ? "Чернова (още не е изпратена)"
                        : row.status === "pending"
                          ? "Чака преглед"
                          : row.status === "approved"
                            ? "Одобрено"
                            : row.status === "rejected"
                              ? "Отхвърлено"
                              : row.status}
                    </p>
                  </div>
                  {row.status === "draft" ? (
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:gap-3">
                      <Link
                        href={`/organizer/festivals/preview/${row.id}`}
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] underline"
                      >
                        Преглед
                      </Link>
                      <Link
                        href={`/organizer/festivals/new?draft=${encodeURIComponent(row.id)}`}
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] underline"
                      >
                        Продължи
                      </Link>
                    </div>
                  ) : null}
                  {row.status === "pending" ? (
                    <Link
                      href={`/organizer/submissions/${row.id}/edit`}
                      className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] underline"
                    >
                      Редакция
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
