import { NextResponse } from "next/server";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";

export type OrganizerClaimMeResponse =
  | { status: "none" }
  | { status: "pending" | "approved" | "rejected"; organizer_slug: string | null };

function mapStatus(status: string | null): "none" | "pending" | "approved" | "rejected" {
  if (!status) return "none";
  if (status === "active") return "approved";
  if (status === "pending") return "pending";
  if (status === "rejected") return "rejected";
  if (status === "revoked") return "rejected";
  return "none";
}

type MemberRow = {
  id: string;
  status: string;
  organizer_id: string;
  created_at: string;
  organizer: unknown;
};

function organizerSlugFromRow(row: MemberRow): string | null {
  const org = row.organizer as { slug?: string | null } | { slug?: string | null }[] | null;
  if (Array.isArray(org)) {
    const s = org[0]?.slug;
    return typeof s === "string" && s.trim() ? s.trim() : null;
  }
  const s = org?.slug;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

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

  const { data, error } = await admin
    .from("organizer_members")
    .select("id, status, organizer_id, created_at, organizer:organizers(slug)")
    .eq("user_id", session.user.id)
    .eq("role", "owner")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/organizer/claims/me] query", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as MemberRow[];

  const row =
    rows.find((r) => r.status === "pending") ??
    rows.find((r) => r.status === "active") ??
    rows.find((r) => r.status === "rejected" || r.status === "revoked") ??
    null;

  if (!row) {
    return NextResponse.json({ status: "none" as const });
  }

  const mapped = mapStatus(row.status);
  if (mapped === "none") {
    return NextResponse.json({ status: "none" as const });
  }

  return NextResponse.json({
    status: mapped,
    organizer_slug: organizerSlugFromRow(row),
  });
}
