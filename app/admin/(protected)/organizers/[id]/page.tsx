import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import OrganizerEditForm from "@/components/admin/OrganizerEditForm";

export default async function AdminOrganizerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/organizers/${id}`);
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/organizers/[id]/page] Admin client initialization failed", { message, id });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Organizer detail is temporarily unavailable.</div>;
  }

  const { data, error } = await adminClient
    .schema("public")
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
