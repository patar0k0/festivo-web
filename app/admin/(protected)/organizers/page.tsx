import Link from "next/link";
import { redirect } from "next/navigation";
import { classifyOrganizerOriginFromMembers, type OrganizerOriginKind } from "@/lib/admin/organizers";
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

export default async function AdminOrganizersPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/organizers");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/organizers/page] Admin client initialization failed", { message });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Organizer list is temporarily unavailable.</div>;
  }

  const { data, error, count } = await adminClient
    .schema("public")
    .from("organizers")
    .select("id,name,slug,verified,claimed_events_count,created_at, organizer_members(status)", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("[admin/organizers/page] organizers query failed", { message: error.message });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const rows = data ?? [];
  console.info("[admin/organizers/page] organizers loaded", { rowCount: rows.length, exactCount: count ?? null });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <h1 className="text-2xl font-black tracking-tight">Organizers</h1>
        <p className="mt-1 text-sm text-black/65">Manage organizer profiles for post-approval enrichment.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href="/admin/organizers/duplicates" className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]">
            Duplicate detection
          </Link>
          <Link href="/admin/organizers/research" className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]">
            Research organizer
          </Link>
          <Link href="/admin/organizer-claims" className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]">
            Заявки от портал
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90">
        <table className="min-w-full text-sm">
          <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Claimed events</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const members = row.organizer_members as { status: string }[] | null | undefined;
              const origin = classifyOrganizerOriginFromMembers(members);
              const badge = ORIGIN_BADGE[origin];
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
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-black/70">{row.slug ?? "-"}</td>
                <td className="px-4 py-3 text-black/70">{row.verified ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-black/70">{row.claimed_events_count ?? 0}</td>
                <td className="px-4 py-3 text-black/70">{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.slug ? (
                      <Link href={`/organizers/${row.slug}`} className="inline-flex items-center rounded-md border border-black/[0.12] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]">
                        View
                      </Link>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-black/[0.08] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-black/35">
                        View
                      </span>
                    )}
                    <Link href={`/admin/organizers/${row.id}/edit`} className="inline-flex items-center rounded-md border border-black/[0.12] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]">
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-black/60">
                  No organizers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
