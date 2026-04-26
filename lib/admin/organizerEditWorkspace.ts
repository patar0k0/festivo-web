import type { SupabaseClient } from "@supabase/supabase-js";
import { fixFestivalText } from "@/lib/queries";
import type { Festival } from "@/lib/types";
import { getCityLabel, getFestivalListingCityPrimary } from "@/lib/settlements/getCityLabel";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";

const FESTIVAL_ADMIN_LINK_SELECT =
  "id,title,slug,start_date,end_date,status,city,city_id,cities(name_bg,slug,is_village)";

export type OrganizerEditInitialCity = { id: number; name_bg: string; slug: string; is_village: boolean | null };

export type OrganizerEditLinkedFestivalRow = {
  id: string;
  title: string;
  slug: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  cityLabel: string;
};

export type OrganizerEditPendingFestivalRow = {
  id: string;
  title: string | null;
  status: string | null;
  cityLabel: string;
  created_at: string | null;
};

export type OrganizerEditPendingClaimRow = {
  id: string;
  created_at: string | null;
  contact_email: string | null;
  user_id: string;
};

export type OrganizerEditWorkspace = {
  initialCity: OrganizerEditInitialCity | null;
  linkedFestivals: OrganizerEditLinkedFestivalRow[];
  pendingFestivals: OrganizerEditPendingFestivalRow[];
  pendingClaims: OrganizerEditPendingClaimRow[];
  counts: {
    linkedTotal: number;
    visibleCatalog: number;
    pendingFestivals: number;
    pendingClaims: number;
  };
};

function visibleCatalogStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  if (status === "archived") return false;
  return status === "published" || status === "verified";
}

function pendingCityLabel(row: {
  city_row: { name_bg: string | null; slug: string | null; is_village: boolean | null } | null;
}): string {
  const nested = row.city_row;
  const nb = nested?.name_bg?.trim();
  return nb ? getCityLabel({ name_bg: fixMojibakeBG(nb) }) : "—";
}

export async function loadOrganizerEditWorkspace(
  adminClient: SupabaseClient,
  options: { organizerId: string; cityId: number | null },
): Promise<OrganizerEditWorkspace> {
  const { organizerId, cityId } = options;

  const [cityRes, m2mRes, legacyRes, pendingFestRes, claimsRes, pendingFestCountRes, claimsCountRes] = await Promise.all([
    cityId != null
      ? adminClient.from("cities").select("id,name_bg,slug,is_village").eq("id", cityId).maybeSingle()
      : Promise.resolve({ data: null as OrganizerEditInitialCity | null }),
    adminClient.from("festival_organizers").select("festival_id").eq("organizer_id", organizerId),
    adminClient.from("festivals").select("id").eq("organizer_id", organizerId),
    adminClient
      .from("pending_festivals")
      .select("id,title,status,city,city_id,created_at,city_row:cities(name_bg,slug,is_village)")
      .eq("organizer_id", organizerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    adminClient
      .from("organizer_members")
      .select("id,created_at,contact_email,user_id")
      .eq("organizer_id", organizerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(15),
    adminClient
      .from("pending_festivals")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", organizerId)
      .eq("status", "pending"),
    adminClient
      .from("organizer_members")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", organizerId)
      .eq("status", "pending"),
  ]);

  const initialCity = (cityRes.data ?? null) as OrganizerEditInitialCity | null;

  if (m2mRes.error) {
    console.error("[loadOrganizerEditWorkspace] festival_organizers failed", { message: m2mRes.error.message });
  }
  if (legacyRes.error) {
    console.error("[loadOrganizerEditWorkspace] legacy festivals failed", { message: legacyRes.error.message });
  }
  if (pendingFestRes.error) {
    console.error("[loadOrganizerEditWorkspace] pending_festivals failed", { message: pendingFestRes.error.message });
  }
  if (claimsRes.error) {
    console.error("[loadOrganizerEditWorkspace] organizer_members failed", { message: claimsRes.error.message });
  }

  const m2mIds = (m2mRes.data ?? []).map((r) => r.festival_id).filter(Boolean) as string[];
  const legacyIds = (legacyRes.data ?? []).map((r) => r.id).filter(Boolean) as string[];
  const festivalIds = Array.from(new Set([...m2mIds, ...legacyIds]));

  let linkedFestivals: OrganizerEditLinkedFestivalRow[] = [];
  let visibleCatalog = 0;

  if (festivalIds.length > 0) {
    const { data: festRows, error: festErr } = await adminClient
      .from("festivals")
      .select(FESTIVAL_ADMIN_LINK_SELECT)
      .in("id", festivalIds)
      .returns<Festival[]>();

    if (festErr) {
      console.error("[loadOrganizerEditWorkspace] festivals query failed", { message: festErr.message });
    } else {
      const fixed = (festRows ?? []).map((r) => fixFestivalText(r));
      visibleCatalog = fixed.filter((f) => visibleCatalogStatus(f.status)).length;
      fixed.sort((a, b) => {
        const ad = a.start_date ?? "";
        const bd = b.start_date ?? "";
        return bd.localeCompare(ad);
      });
      linkedFestivals = fixed.slice(0, 50).map((f) => ({
        id: String(f.id),
        title: f.title,
        slug: f.slug ?? null,
        start_date: f.start_date ?? null,
        end_date: f.end_date ?? null,
        status: f.status ?? null,
        cityLabel: (() => {
          const p = getFestivalListingCityPrimary(f).trim();
          return p || "—";
        })(),
      }));
    }
  }

  const pendingFestivals: OrganizerEditPendingFestivalRow[] = (pendingFestRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      title: string | null;
      status: string | null;
      city: string | null;
      created_at: string | null;
      city_row:
        | { name_bg: string | null; slug: string | null; is_village: boolean | null }
        | { name_bg: string | null; slug: string | null; is_village: boolean | null }[]
        | null;
    };
    const embedded = r.city_row;
    const cityRow = Array.isArray(embedded) ? embedded[0] ?? null : embedded;
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      cityLabel: pendingCityLabel({
        city_row: cityRow,
      }),
      created_at: r.created_at,
    };
  });

  const pendingClaims: OrganizerEditPendingClaimRow[] = (claimsRes.data ?? []) as OrganizerEditPendingClaimRow[];

  const pendingFestivalsCount = pendingFestCountRes.count ?? pendingFestivals.length;
  const pendingClaimsCount = claimsCountRes.count ?? pendingClaims.length;

  return {
    initialCity,
    linkedFestivals,
    pendingFestivals,
    pendingClaims,
    counts: {
      linkedTotal: festivalIds.length,
      visibleCatalog,
      pendingFestivals: pendingFestivalsCount,
      pendingClaims: pendingClaimsCount,
    },
  };
}
