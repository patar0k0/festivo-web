import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { getUserFestivalRole } from "@/lib/organizer/festivalAccess";
import { FestivalRoleBadge } from "@/components/organizer/FestivalRoleBadge";

export const dynamic = "force-dynamic";

type OrganizerLinkRow = {
  role: "owner" | "co_host";
  organizers: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
};

export default async function OrganizerFestivalViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: festivalId } = await params;
  const gate = await requireOrganizerOwnerPortalSession(
    `/organizer/festivals/${festivalId}`,
  );
  if (gate.kind === "redirect") redirect(gate.to);
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-200/55 bg-amber-50/70 px-5 py-6 text-sm text-amber-950/85 shadow-sm">
        Услугата е временно недостъпна. Опитайте по-късно.
      </div>
    );
  }

  const { admin, userId } = gate;
  const role = await getUserFestivalRole(admin, userId, festivalId);
  if (role === null) notFound();

  const { data: festival } = await admin
    .from("festivals")
    .select(
      "id,slug,title,description,description_short,start_date,end_date,city,location_name,hero_image,website_url,ticket_url",
    )
    .eq("id", festivalId)
    .maybeSingle();

  if (!festival) notFound();

  const { data: organizers } = await admin
    .from("festival_organizers")
    .select("role, organizers!inner(id,name,slug,logo_url)")
    .eq("festival_id", festivalId)
    .order("role", { ascending: false });

  const organizerRows = (organizers ?? []) as unknown as OrganizerLinkRow[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/organizer/dashboard"
            className="text-xs text-black/55 hover:underline"
          >
            ← Към таблото
          </Link>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14]">
            {festival.title}
          </h1>
          <div className="mt-2">
            <FestivalRoleBadge role={role} />
          </div>
        </div>
        {role === "owner" ? (
          <Link
            href={`/organizer/festivals/${festival.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-black/85"
          >
            Редактирай
          </Link>
        ) : null}
      </header>

      {role === "co_host" ? (
        <div className="rounded-xl border border-sky-200/60 bg-sky-50/80 px-4 py-3 text-sm text-sky-950/85">
          Участвате като съ-организатор. За промени се свържете със собственика на
          фестивала.
        </div>
      ) : null}

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium text-black/75">Описание</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-black/80">
          {festival.description ?? "—"}
        </p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium text-black/75">Организатори</h2>
        <ul className="mt-3 space-y-2">
          {organizerRows.map((row) =>
            row.organizers ? (
              <li
                key={row.organizers.id}
                className="flex items-center gap-3"
              >
                {row.organizers.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.organizers.logo_url}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-black/[0.06]" />
                )}
                <span className="text-sm">{row.organizers.name}</span>
                <FestivalRoleBadge role={row.role} />
              </li>
            ) : null,
          )}
        </ul>
      </section>
    </div>
  );
}
