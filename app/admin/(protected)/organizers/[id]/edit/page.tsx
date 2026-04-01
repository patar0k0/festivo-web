import { notFound, redirect } from "next/navigation";
import OrganizerEditForm from "@/components/admin/OrganizerEditForm";
import OrganizerOwnershipSection from "@/components/admin/OrganizerOwnershipSection";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function AdminOrganizerEditPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/organizers/${id}/edit`);
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/organizers/[id]/edit/page] Admin client initialization failed", { message, routeParamId: id });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Organizer detail is temporarily unavailable.</div>;
  }

  console.info("[admin/organizers/[id]/edit/page] Loading organizer via service-role client", {
    routeParamId: id,
    usingAdminClient: true,
  });

  const { data: organizerRow, error: organizerError } = await adminClient
    .schema("public")
    .from("organizers")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  console.info("[admin/organizers/[id]/edit/page] Organizer query completed", {
    routeParamId: id,
    usingAdminClient: true,
    rowId: organizerRow?.id ?? null,
    rowName: organizerRow?.name ?? null,
    queryError: organizerError ? organizerError.message : null,
  });

  if (organizerError) {
    console.error("[admin/organizers/[id]/edit/page] Organizer query failed", {
      routeParamId: id,
      message: organizerError.message,
    });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Failed to load organizer: {organizerError.message}</div>;
  }

  if (!organizerRow) {
    console.info("[admin/organizers/[id]/edit/page] Organizer not found by id", { routeParamId: id });
    notFound();
  }

  const { data: ownershipRows, error: ownershipError } = await adminClient
    .schema("public")
    .from("organizer_members")
    .select("id,user_id,role,status,created_at,contact_email,contact_phone")
    .eq("organizer_id", id)
    .order("created_at", { ascending: true });

  if (ownershipError) {
    console.error("[admin/organizers/[id]/edit/page] organizer_members query failed", {
      routeParamId: id,
      message: ownershipError.message,
    });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Failed to load membership: {ownershipError.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OrganizerOwnershipSection members={ownershipRows ?? []} />
      <OrganizerEditForm organizer={organizerRow} />
    </div>
  );
}
