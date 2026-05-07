import { redirect } from "next/navigation";
import NewFestivalSubmissionClient, { type NewFestivalDraftInitial } from "./NewFestivalSubmissionClient";
import { dbTimeToHmInput } from "@/lib/festival/festivalTimeFields";
import {
  assertCanEditOrganizerPending,
  loadPortalPendingFestival,
  requireOrganizerOwnerPortalSession,
} from "@/lib/organizer/portal";

export const dynamic = "force-dynamic";

export default async function NewFestivalSubmissionPage({
  searchParams,
}: {
  searchParams?: Promise<{ draft?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const draftParam = typeof sp.draft === "string" ? sp.draft.trim() : "";

  const gate = await requireOrganizerOwnerPortalSession(
    draftParam ? `/organizer/festivals/new?draft=${encodeURIComponent(draftParam)}` : "/organizer/festivals/new",
  );
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

  const { admin, userId } = gate;

  let initialDraft: NewFestivalDraftInitial | null = null;
  if (draftParam) {
    const meta = await loadPortalPendingFestival(admin, draftParam);
    if (meta?.status === "draft") {
      const editGate = await assertCanEditOrganizerPending(admin, userId, meta);
      if (editGate.ok) {
        const { data: row, error } = await admin
          .from("pending_festivals")
          .select(
            "id,organizer_id,title,description,category,tags,city_id,city_name_display,location_name,address,start_date,end_date,start_time,end_time,website_url,facebook_url,instagram_url,ticket_url,hero_image,is_free,city:cities(name_bg,slug)",
          )
          .eq("id", draftParam)
          .maybeSingle();

        if (!error && row && row.organizer_id) {
          const cityRel = row.city as { name_bg?: string | null; slug?: string | null } | null;
          const city_label =
            (typeof row.city_name_display === "string" && row.city_name_display.trim()) ||
            cityRel?.name_bg ||
            cityRel?.slug ||
            (row.city_id != null ? String(row.city_id) : "");
          const tagsArr = Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [];

          initialDraft = {
            id: row.id,
            organizer_id: row.organizer_id,
            title: row.title ?? "",
            description: typeof row.description === "string" ? row.description : "",
            city: city_label,
            start_date: row.start_date ?? "",
            end_date: row.end_date ?? "",
            start_time: dbTimeToHmInput(row.start_time ?? null),
            end_time: dbTimeToHmInput(row.end_time ?? null),
            location_name: row.location_name ?? "",
            address: row.address ?? "",
            category: (row.category ?? "festival").trim() || "festival",
            tagsInput: tagsArr.join(", "),
            website_url: row.website_url ?? "",
            facebook_url: row.facebook_url ?? "",
            instagram_url: row.instagram_url ?? "",
            ticket_url: row.ticket_url ?? "",
            hero_image: row.hero_image ?? "",
            is_free: row.is_free ?? true,
          };
        }
      }
    }
  }

  return <NewFestivalSubmissionClient initialDraft={initialDraft} />;
}
