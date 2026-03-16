import { notFound, redirect } from "next/navigation";
import FestivalEditForm from "@/components/admin/FestivalEditForm";
import type { OrganizerProfile } from "@/lib/types";
import { getAdminContext } from "@/lib/admin/isAdmin";

export default async function AdminFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin");
  }

  const { data, error } = await ctx.supabase
    .from("festivals")
    .select("*,cities:cities!left(id,name_bg,slug)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }


  const { data: organizersData } = await ctx.supabase
    .from("organizers")
    .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url")
    .order("name", { ascending: true });

  const organizers = (organizersData ?? []) as OrganizerProfile[];

  const cityRow = Array.isArray(data.cities) ? data.cities[0] : data.cities;
  const cityDetails = cityRow ?? null;

  const cityDisplay = cityDetails?.name_bg ?? cityDetails?.slug ?? "";

  console.info(
    `[admin-festival-edit] festival_id=${id} city_id=${cityDetails?.id ?? data.city_id ?? "null"} city_name_bg="${cityDetails?.name_bg ?? ""}" city_slug="${cityDetails?.slug ?? data.city ?? ""}" displayed_city="${cityDisplay ?? ""}"`
  );

  return (
    <FestivalEditForm
      organizers={organizers}
      festival={{
        ...data,
        id: String(data.id),
        city_name: cityDisplay,
        city_slug: cityDetails?.slug ?? data.city ?? null,
      }}
    />
  );
}
