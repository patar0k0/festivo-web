import { NextResponse } from "next/server";
import { fetchActiveMembershipOrganizerIds, getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";

export async function GET() {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const orgIds = await fetchActiveMembershipOrganizerIds(admin, session.user.id);
  if (!orgIds.length) {
    return NextResponse.json({ organizers: [] });
  }

  const { data, error } = await admin.from("organizers").select("id,name,slug").in("id", orgIds).eq("is_active", true).order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organizers: data ?? [] });
}
