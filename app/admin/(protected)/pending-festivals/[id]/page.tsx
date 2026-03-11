import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PendingFestivalEditForm from "@/components/admin/PendingFestivalEditForm";

export default async function AdminPendingFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/pending-festivals/${id}`);
  }

  const { data, error } = await ctx.supabase
    .from("pending_festivals")
    .select(
      "id,title,slug,description,city_id,location_name,address,website_url,ticket_url,price_range,category,region,source_type,latitude,longitude,start_date,end_date,organizer_name,source_url,is_free,hero_image,status,created_at,reviewed_at,reviewed_by,title_clean,description_clean,description_short,category_guess,tags_guess,tags,city_guess,location_guess,date_guess,is_free_guess,normalization_version,deterministic_guess_json,ai_guess_json,merge_decisions_json,latitude_guess,longitude_guess,lat_guess,lng_guess,city:cities(id,name_bg,slug)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }

  return <PendingFestivalEditForm pendingFestival={{ ...data, id: String(data.id) }} />;
}
