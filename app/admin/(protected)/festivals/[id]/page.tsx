import { notFound, redirect } from "next/navigation";
import FestivalEditForm from "@/components/admin/FestivalEditForm";
import { getAdminContext } from "@/lib/admin/isAdmin";

export default async function AdminFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin");
  }

  const { data, error } = await ctx.supabase
    .from("festivals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }

  let cityDetails: { id: number; name_bg: string | null; slug: string | null } | null = null;

  if (data.city_id != null) {
    const { data: cityData } = await ctx.supabase.from("cities").select("id,name_bg,slug").eq("id", data.city_id).maybeSingle();
    cityDetails = cityData ?? null;
  }

  const locationName = (data as { location_name?: string | null }).location_name ?? null;
  const cityDisplay = cityDetails?.name_bg ?? locationName ?? cityDetails?.slug ?? data.city ?? null;

  return (
    <FestivalEditForm
      festival={{
        ...data,
        id: String(data.id),
        city_name: cityDisplay,
        city_slug: cityDetails?.slug ?? data.city ?? null,
      }}
    />
  );
}
