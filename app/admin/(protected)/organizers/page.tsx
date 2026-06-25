import Link from "next/link";
import { redirect } from "next/navigation";
import { classifyOrganizerOriginFromMembers, type OrganizerOriginKind } from "@/lib/admin/organizers";
import {
  classifyOutreachStatus,
  fetchAllOrganizerOutreachContactedMap,
  type OrganizerOutreachStatus,
} from "@/lib/admin/organizerOutreachStatus";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const ORIGIN_BADGE: Record<OrganizerOriginKind, { label: string; className: string }> = {
  portal: {
    label: "Портал",
    className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90",
  },
  pending: {
    label: "Чакащ",
    className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90",
  },
  virtual: {
    label: "Виртуален",
    className: "bg-black/[0.06] text-black/65 ring-1 ring-black/[0.1]",
  },
};

const OUTREACH_BADGE: Record<OrganizerOutreachStatus, { label: string; className: string }> = {
  contacted: {
    label: "Писан",
    className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90",
  },
  not_contacted: {
    label: "Не писан",
    className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90",
  },
  no_email: {
    label: "Без имейл",
    className: "bg-black/[0.06] text-black/65 ring-1 ring-black/[0.1]",
  },
};

const PER_PAGE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

function buildQs(params: { q: string; type: string; outreach: string; page: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type && params.type !== "all") sp.set("type", params.type);
  if (params.outreach && params.outreach !== "all") sp.set("outreach", params.outreach);
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

export default async function AdminOrganizersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/organizers");
  }

  const params = await searchParams;
  const q = asString(params.q).trim();
  const typeFilter = asString(params.type);
  const outreachFilter = asString(params.outreach);
  const pageRaw = Number.parseInt(asString(params.page) || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/organizers/page] Admin client initialization failed", { message });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Organizer list is temporarily unavailable.</div>;
  }

  // `origin` (Тип) and outreach status are both derived in JS (from organizer_members.status
  // and from email_jobs respectively), not DB columns, so neither can be filtered/paginated
  // in SQL. When either filter is active we must fetch the full matching set, classify,
  // filter, THEN paginate in JS — otherwise the filter only sees the current 50-row DB page
  // and both the row list and the total/page count come out wrong. With no derived filter
  // active we keep efficient DB-side paging.
  const hasTypeFilter = Boolean(typeFilter && typeFilter !== "all");
  const hasOutreachFilter = Boolean(outreachFilter && outreachFilter !== "all");
  const hasDerivedFilter = hasTypeFilter || hasOutreachFilter;

  let query = adminClient
    .schema("public")
    .from("organizers")
    // FK hint required: festival_organizers is M2M, so plain `festivals(count)` is ambiguous.
    .select("id,name,slug,email,verified,created_at,organizer_members(status),festivals!festivals_organizer_id_fkey(count),festival_organizers(count)", { count: "exact" })
    .eq("is_active", true);

  if (q) {
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  }

  query = query
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });

  if (!hasDerivedFilter) {
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[admin/organizers/page] organizers query failed", { message: error.message });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const contactedMap = await fetchAllOrganizerOutreachContactedMap(adminClient);

  let rows = (data ?? []).map((row) => {
    const members = row.organizer_members as { status: string }[] | null | undefined;
    const festivalsRaw = row.festivals as { count: number }[] | null | undefined;
    const m2mRaw = row.festival_organizers as { count: number }[] | null | undefined;
    // Use the larger of the two counts — legacy organizer_id + junction table.
    // Festivals linked only via festival_organizers (secondary organizers) are
    // otherwise invisible. Taking max avoids double-counting when both sources
    // contain the same festival.
    const festivalCount = Math.max(
      festivalsRaw?.[0]?.count ?? 0,
      m2mRaw?.[0]?.count ?? 0,
    );
    const outreach = classifyOutreachStatus(row.email, row.id, contactedMap);
    return {
      ...row,
      members,
      origin: classifyOrganizerOriginFromMembers(members),
      festivalCount,
      outreachStatus: outreach.status,
      lastContactedAt: outreach.lastContactedAt,
    };
  });

  // Derived-filter + pagination. When filtering by origin and/or outreach status we
  // fetched the full set above, so filter then slice here and use the FILTERED length
  // as the total — this keeps the counter and page count consistent with what's shown.
  let totalCount: number;
  if (hasDerivedFilter) {
    if (hasTypeFilter) {
      rows = rows.filter((r) => r.origin === typeFilter);
    }
    if (hasOutreachFilter) {
      rows = rows.filter((r) => r.outreachStatus === outreachFilter);
    }
    totalCount = rows.length;
    rows = rows.slice(from, to + 1);
  } else {
    totalCount = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const prevQs = page > 1 ? buildQs({ q, type: typeFilter, outreach: outreachFilter, page: page - 1 }) : null;
  const nextQs = page < totalPages ? buildQs({ q, type: typeFilter, outreach: outreachFilter, page: page + 1 }) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <h1 className="text-2xl font-black tracking-tight">Organizers</h1>
        <p className="mt-1 text-sm text-black/65">
          Manage organizer profiles for post-approval enrichment.
          {totalCount > 0 && (
            <span className="ml-2 text-black/40">({totalCount} общо)</span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/admin/organizers/new"
            className="inline-flex items-center rounded-lg bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/80"
          >
            + Добави
          </Link>
          <Link
            href="/admin/organizers/duplicates"
            className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
          >
            Duplicate detection
          </Link>
          <Link
            href="/admin/organizers/research"
            className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
          >
            Research organizer
          </Link>
          <Link
            href="/admin/organizer-claims"
            className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
          >
            Заявки от портал
          </Link>
        </div>

        {/* Search & filter form */}
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
            Търсене
            <input
              name="q"
              defaultValue={q}
              placeholder="Име или slug…"
              className="mt-1 block w-64 rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/20"
            />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
            Тип
            <select
              name="type"
              defaultValue={typeFilter || "all"}
              className="mt-1 block rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/20"
            >
              <option value="all">Всички</option>
              <option value="portal">Портал</option>
              <option value="pending">Чакащ</option>
              <option value="virtual">Виртуален</option>
            </select>
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
            Кореспонденция
            <select
              name="outreach"
              defaultValue={outreachFilter || "all"}
              className="mt-1 block rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/20"
            >
              <option value="all">Всички</option>
              <option value="not_contacted">Неписани</option>
              <option value="contacted">Писани</option>
              <option value="no_email">Без имейл</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Търси
            </button>
            {(q || (typeFilter && typeFilter !== "all") || (outreachFilter && outreachFilter !== "all")) && (
              <Link
                href="/admin/organizers"
                className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
              >
                Нулирай
              </Link>
            )}
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90">
        <table className="min-w-full text-sm">
          <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Кореспонденция</th>
              <th className="px-4 py-3">Фестивали</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const badge = ORIGIN_BADGE[row.origin];
              return (
                <tr key={row.id} className="border-t border-black/[0.06]">
                  <td className="px-4 py-3 font-semibold">
                    {row.slug ? (
                      <Link href={`/organizers/${row.slug}`} className="hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const outreachBadge = OUTREACH_BADGE[row.outreachStatus];
                      return (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${outreachBadge.className}`}>
                          {outreachBadge.label}
                          {row.lastContactedAt && (
                            <span className="ml-1 font-normal opacity-70">
                              · {new Date(row.lastContactedAt).toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" })}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.festivalCount > 0 ? (
                      <span className="font-semibold text-black/80">{row.festivalCount}</span>
                    ) : (
                      <span className="text-black/30">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-black/70">{row.slug ?? "-"}</td>
                  <td className="px-4 py-3 text-black/70">{row.verified ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-black/70">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" }) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.slug ? (
                        <Link
                          href={`/organizers/${row.slug}`}
                          className="inline-flex items-center rounded-md border border-black/[0.12] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-black/[0.08] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-black/35">
                          View
                        </span>
                      )}
                      <Link
                        href={`/admin/organizers/${row.id}/edit`}
                        className="inline-flex items-center rounded-md border border-black/[0.12] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-black/60">
                  {q ? `Няма резултати за „${q}".` : "No organizers found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3 text-xs text-black/55">
            <span>
              Страница {page} от {totalPages} ({totalCount} организатора)
            </span>
            <div className="flex gap-2">
              {prevQs !== null ? (
                <Link
                  href={`/admin/organizers${prevQs ? `?${prevQs}` : ""}`}
                  className="rounded-md border border-black/[0.12] px-3 py-1 font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                >
                  ← Предишна
                </Link>
              ) : (
                <span className="rounded-md border border-black/[0.06] px-3 py-1 font-semibold uppercase tracking-[0.1em] text-black/25">
                  ← Предишна
                </span>
              )}
              {nextQs !== null ? (
                <Link
                  href={`/admin/organizers?${nextQs}`}
                  className="rounded-md border border-black/[0.12] px-3 py-1 font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                >
                  Следваща →
                </Link>
              ) : (
                <span className="rounded-md border border-black/[0.06] px-3 py-1 font-semibold uppercase tracking-[0.1em] text-black/25">
                  Следваща →
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
