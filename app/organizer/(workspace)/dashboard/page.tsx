import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboardPage() {
  const gate = await requireOrganizerOwnerPortalSession("/organizer/dashboard");
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
  const submissionCount = submissions?.length ?? 0;
  const hasSubmissions = submissionCount > 0;
  const profileEditHref =
    orgRows?.[0]?.id != null ? `/organizer/organizations/${orgRows[0].id}/edit` : "/organizer/profile/new";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Започни с първия си фестивал</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm">
          <p className="font-medium text-[#0c0e14]">Профил</p>
          <p className="mt-1 text-black/70">Готов</p>
          <p className="text-xs font-medium text-black mt-1 hover:underline">
            <Link href={profileEditHref} className="text-inherit">
              Редактирай профила
            </Link>
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 text-sm ${
            !hasSubmissions ? "border-black bg-white" : "border-gray-300 bg-gray-50"
          }`}
        >
          <p className="font-medium text-[#0c0e14]">Фестивал</p>
          <p className="mt-1 text-black/70">
            {!hasSubmissions ? "Все още нямаш фестивал" : "Създаден"}
          </p>
          <p className="text-xs font-medium text-black mt-1 hover:underline">
            <Link href="/organizer/festivals/new" className="text-inherit">
              Добави фестивал
            </Link>
          </p>
          {!hasSubmissions ? (
            <a
              href="/organizer/festivals/new"
              className="mt-2 inline-flex rounded-lg bg-black px-3 py-1.5 text-xs text-white hover:bg-black/90"
            >
              Добави фестивал
            </a>
          ) : null}
        </div>
        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm">
          <p className="font-medium text-[#0c0e14]">Промоция</p>
          <p className="mt-1 text-black/70">
            {submissionCount === 0
              ? "Неактивна"
              : "Промотирането ще увеличи видимостта на фестивала ти"}
          </p>
          <p className="text-xs font-medium text-black mt-1 hover:underline">
            <Link href="/organizer/benefits" className="text-inherit">
              Виж опциите за промоция
            </Link>
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Промотирането ще помогне на повече хора да открият фестивала ти.
      </p>

      <div className="mt-8 rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
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
              <li key={org.id} className="rounded-xl border border-black/[0.08] bg-white px-4 py-3">
                <p className="font-semibold text-[#0c0e14]">{org.name}</p>
                <p className="text-xs text-black/50">/{org.slug}</p>
                <div className="mt-2 flex gap-3">
                  <a
                    href={`/organizer/organizations/${org.id}/edit`}
                    className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Редактирай профила
                  </a>
                  <a
                    href={`/organizers/${org.slug}`}
                    className="inline-flex items-center text-sm text-gray-500 underline"
                  >
                    Публичен профил
                  </a>
                </div>
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
            Добави фестивал
          </Link>
        </div>
        {!submissions?.length ? (
          <p className="mt-3 text-sm text-gray-600">Все още нямаш подадени фестивали</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.06] text-sm">
            {(submissions ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-[#0c0e14]">{row.title}</p>
                  <p className="text-xs text-black/50">
                    {row.status === "pending"
                      ? "Чака преглед"
                      : row.status === "approved"
                        ? "Одобрено"
                        : row.status === "rejected"
                          ? "Отхвърлено"
                          : row.status}
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
