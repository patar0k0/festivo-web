import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OrganizerPendingEditForm from "@/components/organizer/OrganizerPendingEditForm";
import {
  assertCanEditOrganizerPending,
  loadPortalPendingFestival,
  requireActiveOrganizerPortalSession,
} from "@/lib/organizer/portal";

export const dynamic = "force-dynamic";

export default async function OrganizerEditSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireActiveOrganizerPortalSession(`/organizer/submissions/${id}/edit`);
  if (access.kind === "redirect") {
    redirect(access.to);
  }
  if (access.kind === "unavailable") {
    return <div className="text-sm text-black/60">Услугата е временно недостъпна.</div>;
  }

  const { admin, userId } = access;

  const meta = await loadPortalPendingFestival(admin, id);
  if (!meta) {
    notFound();
  }

  const editGate = await assertCanEditOrganizerPending(admin, userId, meta);
  if (!editGate.ok) {
    redirect("/organizer/submissions");
  }

  const { data: row, error } = await admin
    .from("pending_festivals")
    .select(
      "id,title,description,category,tags,city_id,city_name_display,location_name,address,start_date,end_date,start_time,end_time,slug,source_url,website_url,facebook_url,instagram_url,ticket_url,hero_image,price_range,is_free,city:cities(name_bg,slug)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    notFound();
  }

  const cityRel = row.city as { name_bg?: string | null; slug?: string | null } | null;
  const city_label =
    (typeof row.city_name_display === "string" && row.city_name_display.trim()) ||
    cityRel?.name_bg ||
    cityRel?.slug ||
    (row.city_id != null ? String(row.city_id) : "");

  const tagsArr = Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <Link href="/organizer/submissions" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-[#0c0e14]">
          ← Подавания
        </Link>
        <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold">Редакция на подаване</h1>
        <p className="mt-2 text-sm text-black/60">Промените отиват отново в опашката за модерация.</p>
      </div>

      <OrganizerPendingEditForm
        initial={{
          id: row.id,
          title: row.title ?? "",
          description: row.description ?? null,
          city_label,
          location_name: row.location_name ?? null,
          address: row.address ?? null,
          category: row.category ?? null,
          tags: tagsArr,
          start_date: row.start_date ?? null,
          end_date: row.end_date ?? null,
          start_time: row.start_time ?? null,
          end_time: row.end_time ?? null,
          slug: typeof row.slug === "string" ? row.slug : null,
          source_url: typeof row.source_url === "string" ? row.source_url : null,
          website_url: row.website_url ?? null,
          facebook_url: row.facebook_url ?? null,
          instagram_url: row.instagram_url ?? null,
          ticket_url: row.ticket_url ?? null,
          hero_image: row.hero_image ?? null,
          price_range: row.price_range ?? null,
          is_free: row.is_free ?? true,
        }}
      />
    </div>
  );
}
