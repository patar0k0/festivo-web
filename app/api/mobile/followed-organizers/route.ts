import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";

export const dynamic = "force-dynamic";

type OrganizerRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
};

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await auth.supabase
      .from("user_followed_organizers")
      .select("organizer_id, organizers!inner(id, slug, name, logo_url)")
      .eq("user_id", auth.user.id)
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const organizers = (data ?? []).flatMap((row) => {
      const org = (Array.isArray(row.organizers) ? row.organizers[0] : row.organizers) as OrganizerRow | null;
      if (!org?.slug) return [];
      return [
        {
          organizerId: String(org.id ?? row.organizer_id),
          slug: String(org.slug),
          name: typeof org.name === "string" ? org.name : "",
          logo_url: typeof org.logo_url === "string" ? org.logo_url : null,
        },
      ];
    });

    return NextResponse.json({ organizers });
  } catch (error) {
    console.error("[api/mobile/followed-organizers] GET", error);
    return NextResponse.json({ error: "Failed to load followed organizers" }, { status: 500 });
  }
}
