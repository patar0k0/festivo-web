import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import OrganizerEditForm from "@/components/admin/OrganizerEditForm";

export default async function AdminOrganizerDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await Promise.resolve(params);
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

  console.info("[admin/organizers/[id]/page] Loading organizer via service-role client", {
    id,
    usingAdminClient: true,
  });

  const { data, error } = await adminClient
    .schema("public")
    .from("organizers")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  console.info("[admin/organizers/[id]/page] Organizer query completed", {
    id,
    found: Boolean(data),
    rowId: data?.id ?? null,
    rowName: data?.name ?? null,
    queryError: error ? error.message : null,
  });

  if (error) {
    console.error("[admin/organizers/[id]/page] Organizer query failed", { id, message: error.message });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    console.info("[admin/organizers/[id]/page] Organizer not found by id", { id });
    notFound();
  }

  return <OrganizerEditForm organizer={data} />;
}
