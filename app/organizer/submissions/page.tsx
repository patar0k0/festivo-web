import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerPortalNav from "@/components/organizer/OrganizerPortalNav";
import { fetchActiveMembershipOrganizerIds, getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import "../landing.css";

export const dynamic = "force-dynamic";

export default async function OrganizerSubmissionsPage() {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    redirect("/login?next=/organizer/submissions");
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return <div className="p-8 text-sm text-black/60">Услугата е временно недостъпна.</div>;
  }

  const orgIds = await fetchActiveMembershipOrganizerIds(admin, session.user.id);
  const { data: submissions } =
    orgIds.length > 0
      ? await admin
          .from("pending_festivals")
          .select("id,title,status,created_at,submission_source")
          .in("organizer_id", orgIds)
          .eq("submission_source", "organizer_portal")
          .order("created_at", { ascending: false })
          .limit(80)
      : { data: [] as { id: string; title: string; status: string; created_at: string }[] };

  return (
    <div className="landing-bg min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
          <Link href="/organizer/dashboard" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-[#0c0e14]">
            ← Табло
          </Link>
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold">Моите подавания</h1>
          <div className="mt-6">
            <OrganizerPortalNav />
          </div>
        </div>

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
              {(submissions ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
                  <div>
                    <p className="font-semibold text-[#0c0e14]">{row.title}</p>
                    <p className="text-xs text-black/50">
                      {row.status === "pending"
                        ? "Чака преглед"
                        : row.status === "approved"
                          ? "Одобрено"
                          : row.status === "rejected"
                            ? "Отхвърлено"
                            : row.status}{" "}
                      · {new Date(row.created_at).toLocaleString("bg-BG")}
                    </p>
                  </div>
                  {row.status === "pending" ? (
                    <Link
                      href={`/organizer/submissions/${row.id}/edit`}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] underline"
                    >
                      Редакция
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
