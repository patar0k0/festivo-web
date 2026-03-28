import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerMemberApproveButton from "@/components/admin/OrganizerMemberApproveButton";
import { getAdminContext } from "@/lib/admin/isAdmin";

export const dynamic = "force-dynamic";

export default async function AdminOrganizerClaimsPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/organizer-claims");
  }

  const { data, error } = await ctx.supabase
    .from("organizer_members")
    .select("id,created_at,role,user_id,organizer_id,organizer:organizers(name,slug)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6 px-4 py-8 text-[#0c0e14] md:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Админ</p>
        <h1 className="mt-1 text-2xl font-bold">Заявки за организаторски профили</h1>
        <p className="mt-2 max-w-2xl text-sm text-black/60">
          Потребители, които искат да поемат съществуващ публичен профил. След одобрение получават активно членство като собственик.
        </p>
        <Link href="/admin/organizers" className="mt-3 inline-block text-sm font-semibold text-[#0c0e14] underline">
          ← Към организатори
        </Link>
      </div>

      {!rows.length ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-6 py-12 text-center text-sm text-black/55">Няма чакащи заявки.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-sm">
          <table className="min-w-full divide-y divide-black/[0.08] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.12em] text-black/50">
              <tr>
                <th className="px-4 py-3">Организатор</th>
                <th className="px-4 py-3">Потребител</th>
                <th className="px-4 py-3">Роля</th>
                <th className="px-4 py-3">Създадена</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {rows.map((row) => {
                const org = row.organizer as { name?: string | null; slug?: string | null } | null;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{org?.name ?? "—"}</span>
                      {org?.slug ? (
                        <p className="text-xs text-black/45">
                          <Link href={`/organizers/${org.slug}`} className="underline">
                            /organizers/{org.slug}
                          </Link>
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-black/65">{row.user_id}</td>
                    <td className="px-4 py-3 text-black/65">{row.role}</td>
                    <td className="px-4 py-3 text-black/65">{row.created_at ? new Date(row.created_at).toLocaleString("bg-BG") : "—"}</td>
                    <td className="px-4 py-3">
                      <OrganizerMemberApproveButton memberId={row.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
