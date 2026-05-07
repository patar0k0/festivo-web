import { NextResponse } from "next/server";
import { getMobileOrganizerBySlug } from "@/lib/mobile/organizers";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const { organizer, requestedSlug, normalizedSlug } = await getMobileOrganizerBySlug(slug);
    if (!organizer) {
      console.info("[api/mobile/organizers/[slug]] Organizer not found", {
        requestedSlug,
        normalizedSlug,
        reason: "no_active_organizer_for_slug",
      });
      return NextResponse.json({ error: "Organizer not found" }, { status: 404 });
    }

    console.info("[api/mobile/organizers/[slug]] Organizer resolved", {
      requestedSlug,
      normalizedSlug,
      organizerId: organizer.id,
    });

    return NextResponse.json({ organizer }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/mobile/organizers/[slug]] Lookup failed", {
      requestedSlug: slug,
      reason: "query_failed",
      error: message,
    });
    return NextResponse.json({ error: "Organizer lookup failed" }, { status: 500 });
  }
}

