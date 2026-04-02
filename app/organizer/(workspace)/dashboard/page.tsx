import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrganizerPortalSession } from "@/lib/organizer/portal";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboardPage() {
  const gate = await requireActiveOrganizerPortalSession("/organizer/dashboard");
  if (gate.kind === "redirect") {
    redirect(gate.to);
  }
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 text-sm text-black/65 shadow-sm">
        Услугата е временно недостъпна. Опитайте по-късно.
      </div>
    );
  }

  const { admin, orgIds } = gate;

  const { data: orgRows } =
    orgIds.length > 0
      ? await admin.from("organizers").select("id,name,slug").in("id", orgIds).eq("is_active", true)
      : { data: [] as { id: string; name: string; slug: string }[] };

  const { data: submissions } =
    orgIds.length > 0
      ? await admin
          .from("pending_festivals")
          .select("id,title,status,created_at,organizer_id,submission_source")
          .in("organizer_id", orgIds)
          .eq("submission_source", "organizer_portal")
          .order("created_at", { ascending: false })
          .limit(40)
      : { data: [] as { id: string; title: string; status: string; created_at: string; organizer_id: string | null }[] };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">Табло за организатори</h1>
        <p className="mt-2 text-sm text-black/60">Управление на профили и подавания за модерация.</p>
      </div>

      <section className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-semibold text-[#0c0e14]">Моите организации</h2>
        {!orgRows?.length ? (
          <p className="mt-3 text-sm text-black/60">
            Няма активни профили.{" "}
            <Link href="/organizer/profile/new" className="font-medium text-[#0c0e14] underline underline-offset-2">
              Създайте профил
            </Link>{" "}
            или{" "}
            <Link href="/organizer/claim" className="font-medium text-[#0c0e14] underline underline-offset-2">
              заявете съществуващ
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(orgRows ?? []).map((org) => (
              <li key={org.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-3">
                <div>
                  <p className="font-semibold text-[#0c0e14]">{org.name}</p>
                  <p className="text-xs text-black/50">/{org.slug}</p>
                </div>
                <Link href={`/organizers/${org.slug}`} className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] underline">
                  Публичен профил
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0c0e14]">Подавания</h2>
          <Link
            href="/organizer/festivals/new"
            className="inline-flex rounded-lg bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            Нов фестивал
          </Link>
        </div>
        {!submissions?.length ? (
          <p className="mt-3 text-sm text-black/60">Все още няма подавания от тази зона.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.06] text-sm">
            {(submissions ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-[#0c0e14]">{row.title}</p>
                  <p className="text-xs text-black/50">
                    {row.status === "pending" ? "Чака преглед" : row.status === "approved" ? "Одобрено" : row.status === "rejected" ? "Отхвърлено" : row.status}
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
        <p className="mt-4 text-xs text-black/45">
          Пълен преглед и одобрение: екипът на Festivo в админ опашката за чакащи фестивали.
        </p>
      </section>
    </div>
  );
}
