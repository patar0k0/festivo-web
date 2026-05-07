import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import FestivalDetailClient from "@/components/festival/FestivalDetailClient";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { dbTimeToHmInput } from "@/lib/festival/festivalTimeFields";
import { pub } from "@/lib/public-ui/styles";
import type { Festival } from "@/lib/types";
import {
  assertCanEditOrganizerPending,
  loadPortalPendingFestival,
  requireOrganizerOwnerPortalSession,
} from "@/lib/organizer/portal";

export const dynamic = "force-dynamic";

export default async function OrganizerFestivalPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireOrganizerOwnerPortalSession(`/organizer/festivals/preview/${id}`);
  if (access.kind === "redirect") {
    redirect(access.to);
  }
  if (access.kind === "unavailable") {
    return <div className="text-sm text-black/60">Услугата е временно недостъпна.</div>;
  }

  const { admin, userId } = access;

  const meta = await loadPortalPendingFestival(admin, id);
  if (!meta || meta.status !== "draft") {
    notFound();
  }

  const editGate = await assertCanEditOrganizerPending(admin, userId, meta);
  if (!editGate.ok) {
    redirect("/organizer/festivals/new");
  }

  const { data: row, error } = await admin
    .from("pending_festivals")
    .select(
      "id,slug,title,description,category,tags,city_id,city_name_display,location_name,address,start_date,end_date,start_time,end_time,hero_image,is_free,website_url,ticket_url,organizer_id,organizer_name,city:cities(name_bg,slug),organizer:organizers!left(id,name,slug)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    notFound();
  }

  const cityRel = row.city as { name_bg?: string | null; slug?: string | null } | null;
  const cityDisplay =
    (typeof row.city_name_display === "string" && row.city_name_display.trim()) ||
    cityRel?.name_bg ||
    "";
  const orgRel = row.organizer as { id?: string | null; name?: string | null; slug?: string | null } | null;
  const organizerName = orgRel?.name?.trim() || row.organizer_name?.trim() || "";
  const slug = typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : `draft-${row.id}`;
  const tagsArr = Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [];
  const hero = typeof row.hero_image === "string" && row.hero_image.trim() ? row.hero_image.trim() : null;

  const startHm = dbTimeToHmInput(row.start_time ?? null);
  const endHm = dbTimeToHmInput(row.end_time ?? null);

  const previewFestival: Festival = {
    id: row.id,
    slug,
    title: (row.title ?? "").trim() || "Без заглавие",
    description: typeof row.description === "string" ? row.description : "",
    location_name: row.location_name ?? null,
    address: row.address ?? null,
    cities: cityDisplay
      ? {
          name_bg: cityDisplay,
          slug: cityRel?.slug ?? null,
        }
      : null,
    organizer_name: organizerName,
    organizer: orgRel?.id
      ? { id: orgRel.id, name: orgRel.name ?? organizerName, slug: orgRel.slug ?? null }
      : row.organizer_id
        ? { id: row.organizer_id, name: organizerName, slug: null }
        : null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    start_time: startHm ? `${startHm}:00` : null,
    end_time: endHm ? `${endHm}:00` : null,
    hero_image: hero,
    image_url: hero,
    category: row.category ?? null,
    tags: tagsArr,
    is_free: row.is_free ?? true,
    website_url: row.website_url ?? null,
    ticket_url: row.ticket_url ?? null,
  };

  const calendarMonth =
    previewFestival.start_date && previewFestival.start_date.length >= 7
      ? previewFestival.start_date.slice(0, 7)
      : null;

  return (
    <div className="max-w-6xl mx-auto w-full space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-100 text-center px-3 py-2 text-sm text-amber-950">
        Преглед — фестивалът още не е публикуван.{" "}
        <Link href={`/organizer/festivals/new?draft=${encodeURIComponent(id)}`} className="font-medium underline underline-offset-2">
          Редактирай
        </Link>
      </div>

      <div className={pub.page}>
        <Section className={pub.section}>
          <Container>
            <FestivalDetailClient
              festival={previewFestival}
              media={[]}
              days={[]}
              scheduleItems={[]}
              mapHref={null}
              mapEmbedSrc={null}
              citySlug={cityRel?.slug ?? null}
              calendarMonth={calendarMonth}
              relatedFestivals={[]}
              accommodationOffers={[]}
              adminEditHref={null}
              showTravelPopularLabel={false}
              programItemPlanActions={false}
              previewMode
            />
          </Container>
        </Section>
      </div>
    </div>
  );
}
