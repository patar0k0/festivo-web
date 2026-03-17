import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import OrganizerEditForm from "@/components/admin/OrganizerEditForm";

export default async function AdminOrganizerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/organizers/${id}`);
  }

  const { data, error } = await ctx.supabase
    .from("organizers")
    .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,email,phone,verified,city_id,claimed_events_count,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }

  return <OrganizerEditForm organizer={data} />;
}
