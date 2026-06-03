import { notFound, redirect } from "next/navigation";
import FestivalEditForm from "@/components/admin/FestivalEditForm";
import { FestivalCancelDialog } from "@/components/admin/FestivalCancelDialog";
import type { OrganizerProfile } from "@/lib/types";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { publishedRowsToProgramDraft } from "@/lib/festival/programDraft";
import { listAllFestivalCategories } from "@/lib/festivals/categories.server";

export default async function AdminFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin");
  }

  const { data, error } = await ctx.supabase
    .from("festivals")
    .select("*,cities:cities!festivals_city_id_fkey(id,name_bg,slug)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }

  // Single client for all privileged queries
  const adminClient = createSupabaseAdmin();

  // Run all independent queries in parallel
  const [
    organizersResult,
    linksResult,
    mediaResult,
    planCountResult,
    categoriesResult,
    dayRowsResult,
  ] = await Promise.allSettled([
    adminClient
      .from("organizers")
      .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,created_at,plan,plan_started_at,plan_expires_at", { count: "exact" })
      .order("name", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false }),
    adminClient
      .from("festival_organizers")
      .select("organizer_id,sort_order")
      .eq("festival_id", id)
      .order("sort_order", { ascending: true })
      .returns<Array<{ organizer_id: string; sort_order: number | null }>>(),
    adminClient
      .from("festival_media")
      .select("id, url, type, sort_order, is_hero")
      .eq("festival_id", id)
      .order("sort_order", { ascending: true }),
    adminClient
      .from("user_plan_festivals")
      .select("*", { count: "exact", head: true })
      .eq("festival_id", id),
    listAllFestivalCategories(),
    adminClient
      .from("festival_days")
      .select("id, date, title")
      .eq("festival_id", id)
      .order("date", { ascending: true }),
  ]);

  // Organizers
  let organizers: OrganizerProfile[] = [];
  if (organizersResult.status === "fulfilled" && !organizersResult.value.error) {
    organizers = (organizersResult.value.data ?? []) as OrganizerProfile[];
  } else {
    console.error("[admin-festival-edit] organizers query failed", { festivalId: id });
  }

  // Selected organizer IDs
  let selectedOrganizerIds: string[] = [];
  if (linksResult.status === "fulfilled" && !linksResult.value.error) {
    selectedOrganizerIds = (linksResult.value.data ?? []).map((row) => row.organizer_id).filter(Boolean);
  } else {
    console.error("[admin-festival-edit] links query failed", { festivalId: id });
  }

  // Media
  let initialMedia: Array<{ id: string; url: string; type: string | null; sort_order: number | null; is_hero?: boolean | null }> = [];
  if (mediaResult.status === "fulfilled" && !mediaResult.value.error && mediaResult.value.data) {
    initialMedia = mediaResult.value.data.map((row) => ({
      id: String(row.id),
      url: typeof row.url === "string" ? row.url : "",
      type: typeof row.type === "string" ? row.type : null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
      is_hero: row.is_hero ?? null,
    }));
  }

  // Plan users count
  const planUsersCount =
    planCountResult.status === "fulfilled" && !planCountResult.value.error
      ? (planCountResult.value.count ?? 0)
      : 0;

  // Categories
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];

  // Program draft — schedule items depend on dayRows, so fetched sequentially after
  let initialProgramDraft = undefined;
  if (dayRowsResult.status === "fulfilled" && !dayRowsResult.value.error && dayRowsResult.value.data?.length) {
    const dayRows = dayRowsResult.value.data;
    try {
      const dayIds = dayRows.map((d) => String(d.id));
      const { data: itemRows, error: itemErr } = await adminClient
        .from("festival_schedule_items")
        .select("day_id, title, start_time, end_time, stage, description, sort_order")
        .in("day_id", dayIds)
        .order("sort_order", { ascending: true })
        .order("start_time", { ascending: true });
      if (!itemErr) {
        initialProgramDraft = publishedRowsToProgramDraft(
          dayRows.map((d) => ({ id: String(d.id), date: String(d.date), title: d.title })),
          (itemRows ?? []) as Array<{
            day_id: string;
            title: string;
            start_time: string | null;
            end_time: string | null;
            stage: string | null;
            description: string | null;
            sort_order: number | null;
          }>,
        );
      }
    } catch {
      /* optional */
    }
  }

  const cityRow = Array.isArray(data.cities) ? data.cities[0] : data.cities;
  const cityDetails = cityRow ?? null;
  const cityDisplay = cityDetails?.name_bg ?? cityDetails?.slug ?? "";

  return (
    <div>
      <FestivalEditForm
        organizers={organizers}
        initialMedia={initialMedia}
        initialProgramDraft={initialProgramDraft}
        categories={categories}
        festival={{
          ...data,
          id: String(data.id),
          city_name: cityDisplay,
          city_slug: cityDetails?.slug ?? data.city ?? null,
          organizer_ids: selectedOrganizerIds.length ? selectedOrganizerIds : data.organizer_id ? [data.organizer_id] : [],
        }}
      />
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <FestivalCancelDialog
          festivalId={id}
          festivalTitle={typeof data.title === "string" ? data.title : ""}
          lifecycleState={(data.lifecycle_state as "active" | "cancelled") ?? "active"}
          planUsersCount={planUsersCount}
        />
      </div>
    </div>
  );
}
