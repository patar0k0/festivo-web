import { redirect } from "next/navigation";
import OrganizerProfileEditForm from "@/components/organizer/OrganizerProfileEditForm";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";

export const dynamic = "force-dynamic";

type OrganizerEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizerEditPage({ params }: OrganizerEditPageProps) {
  const { id } = await params;
  const gate = await requireOrganizerOwnerPortalSession(`/organizer/organizations/${id}/edit`);

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

  if (!gate.orgIds.includes(id)) {
    redirect("/organizer");
  }

  const { admin } = gate;
  const { data: organizer, error: organizerError } = await admin
    .from("organizers")
    .select(
      "id,slug,name,description,logo_url,website_url,facebook_url,instagram_url,email,phone,verified,city_id",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (organizerError) {
    console.error("[organizer/organizations/[id]/edit] load organizer failed", organizerError.message);
    throw new Error(organizerError.message);
  }

  if (!organizer) {
    redirect("/organizer");
  }

  const { data: cityRows, error: citiesError } = await admin
    .from("cities")
    .select("id,name_bg")
    .order("name_bg", { ascending: true });

  if (citiesError) {
    console.error("[organizer/organizations/[id]/edit] load cities failed", citiesError.message);
    throw new Error(citiesError.message);
  }

  const cityOptions = (cityRows ?? [])
    .map((row) => {
      const rawId = row.id as number | string | null | undefined;
      const nid = typeof rawId === "string" ? Number(rawId) : rawId;
      if (typeof nid !== "number" || !Number.isFinite(nid) || nid <= 0) return null;
      const label = typeof row.name_bg === "string" ? fixMojibakeBG(row.name_bg.trim()) : "";
      if (!label) return null;
      return { id: nid, name_bg: label };
    })
    .filter((x): x is { id: number; name_bg: string } => x !== null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">Профил на организатор</h1>
        <p className="mt-2 text-sm text-black/60">Това е страницата, която виждат посетителите.</p>
      </div>

      <OrganizerProfileEditForm
        organizerId={id}
        publicProfileSlug={organizer.slug ?? ""}
        cities={cityOptions}
        initial={{
          name: organizer.name ?? "",
          description: organizer.description ?? "",
          logo_url: organizer.logo_url ?? "",
          website_url: organizer.website_url ?? "",
          facebook_url: organizer.facebook_url ?? "",
          instagram_url: organizer.instagram_url ?? "",
          email: organizer.email ?? "",
          phone: organizer.phone ?? "",
          verified: Boolean(organizer.verified),
          city_id:
            organizer.city_id != null && Number.isFinite(Number(organizer.city_id))
              ? Number(organizer.city_id)
              : null,
        }}
      />
    </div>
  );
}
