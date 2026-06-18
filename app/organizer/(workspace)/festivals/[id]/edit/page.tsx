import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { getUserFestivalRole } from "@/lib/organizer/festivalAccess";
import { CoOrganizersSection } from "@/components/organizer/CoOrganizersSection";
import { FestivalRoleBadge } from "@/components/organizer/FestivalRoleBadge";
import { FestivalEditForm } from "@/components/organizer/FestivalEditForm";

export const dynamic = "force-dynamic";

type OrganizerLinkRow = {
  organizer_id: string;
  role: "owner" | "co_host";
  organizers: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
};

export default async function OrganizerFestivalEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: festivalId } = await params;
  const gate = await requireOrganizerOwnerPortalSession(
    `/organizer/festivals/${festivalId}/edit`,
  );
  if (gate.kind === "redirect") redirect(gate.to);
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-200/55 bg-amber-50/70 px-5 py-6 text-sm">
        Услугата е временно недостъпна.
      </div>
    );
  }

  const { admin, userId } = gate;
  const role = await getUserFestivalRole(admin, userId, festivalId);
  if (role !== "owner") {
    if (role === "co_host") redirect(`/organizer/festivals/${festivalId}`);
    notFound();
  }

  const { data: festival } = await admin
    .from("festivals")
    .select(
      "id,title,description,description_short,website_url,ticket_url,price_range,is_free",
    )
    .eq("id", festivalId)
    .maybeSingle();

  if (!festival) notFound();

  const { data: organizers } = await admin
    .from("festival_organizers")
    .select("organizer_id, role, organizers!inner(id,name,slug,logo_url)")
    .eq("festival_id", festivalId)
    .order("role", { ascending: false });

  const organizerRows = (organizers ?? []) as unknown as OrganizerLinkRow[];

  const safeOrganizers = organizerRows
    .filter((row): row is OrganizerLinkRow & { organizers: NonNullable<OrganizerLinkRow["organizers"]> } =>
      row.organizers !== null,
    )
    .map((row) => ({
      organizer_id: row.organizer_id,
      role: row.role,
      organizers: row.organizers,
    }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/organizer/festivals/${festival.id}`}
            className="text-xs text-black/55 hover:underline"
          >
            ← Назад към фестивала
          </Link>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14]">
            Редактирай: {festival.title}
          </h1>
          <div className="mt-2">
            <FestivalRoleBadge role="owner" />
          </div>
        </div>
      </header>

      <FestivalEditForm festival={festival} />

      <CoOrganizersSection festivalId={festival.id} initial={safeOrganizers} />
    </div>
  );
}
