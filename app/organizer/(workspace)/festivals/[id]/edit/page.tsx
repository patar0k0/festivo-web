import { redirect } from "next/navigation";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { dbTimeToHmInput } from "@/lib/festival/festivalTimeFields";
import { normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { publishedRowsToProgramDraft } from "@/lib/festival/programDraft";
import OrganizerFestivalEditClient, { type OrganizerFestivalEditInitial } from "./OrganizerFestivalEditClient";

export default async function OrganizerFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/organizer/festivals/${id}/edit`)}`);
  }

  let admin: ReturnType<typeof getPortalAdminClient>;
  try {
    admin = getPortalAdminClient();
  } catch {
    redirect("/organizer/dashboard");
  }

  const gate = await assertOrganizerCanEditPublishedFestival(admin, session!.user.id, id);
  if (!gate.ok) {
    redirect("/organizer/dashboard");
  }

  const { data: festival } = await admin
    .from("festivals")
    .select(
      "id,title,description,description_short,category,tags,city_id,city,location_name,address,start_date,end_date,start_time,end_time,occurrence_dates,hero_image,website_url,ticket_url,price_range,is_free,video_url",
    )
    .eq("id", id)
    .maybeSingle();

  if (!festival) {
    redirect("/organizer/dashboard");
  }

  const { data: cityRow } = festival.city_id
    ? await admin.from("cities").select("name_bg").eq("id", festival.city_id).maybeSingle()
    : { data: null as { name_bg: string } | null };

  const { data: mediaRows } = await admin
    .from("festival_media")
    .select("id, url, sort_order")
    .eq("festival_id", id)
    .eq("is_hero", false)
    .order("sort_order", { ascending: true });

  const { data: dayRows } = await admin
    .from("festival_days")
    .select("id, date, title")
    .eq("festival_id", id)
    .order("date", { ascending: true });

  const dayIds = (dayRows ?? []).map((d) => String(d.id));
  const { data: itemRows } = dayIds.length
    ? await admin
        .from("festival_schedule_items")
        .select("day_id, title, start_time, end_time, stage, description, sort_order")
        .in("day_id", dayIds)
        .order("sort_order", { ascending: true })
    : { data: [] as never[] };

  const programDraft = publishedRowsToProgramDraft(
    (dayRows ?? []).map((d) => ({ id: String(d.id), date: String(d.date), title: d.title })),
    itemRows ?? [],
  );

  const initial: OrganizerFestivalEditInitial = {
    id: festival.id,
    title: festival.title ?? "",
    description: festival.description ?? "",
    descriptionShort: festival.description_short ?? "",
    category: festival.category ?? "",
    tagsInput: Array.isArray(festival.tags) ? festival.tags.join(", ") : "",
    city: cityRow?.name_bg ?? festival.city ?? "",
    locationName: festival.location_name ?? "",
    address: festival.address ?? "",
    startDate: festival.start_date ?? "",
    endDate: festival.end_date ?? "",
    startTime: dbTimeToHmInput(festival.start_time ?? null),
    endTime: dbTimeToHmInput(festival.end_time ?? null),
    occurrenceDates: normalizeOccurrenceDatesInput(festival.occurrence_dates) ?? [],
    heroImage: festival.hero_image ?? "",
    websiteUrl: festival.website_url ?? "",
    ticketUrl: festival.ticket_url ?? "",
    priceRange: festival.price_range ?? "",
    isFree: festival.is_free ?? true,
    videoUrl: festival.video_url ?? "",
    gallery: (mediaRows ?? []).map((m) => ({ id: String(m.id), url: String(m.url) })),
    programDraft,
  };

  return <OrganizerFestivalEditClient initial={initial} />;
}
