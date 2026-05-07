import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { normalizePublicOrganizerSlugParam } from "@/lib/queries";

type DbClient = NonNullable<ReturnType<typeof supabaseAdmin>> | NonNullable<ReturnType<typeof supabaseServer>>;

export type MobileOrganizerPayload = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  verified: boolean | null;
};

function getDbClient(): DbClient | null {
  return supabaseAdmin() ?? supabaseServer();
}

export function getMobileDbClient(): DbClient | null {
  return getDbClient();
}

function sanitizeSlugForLike(slug: string): string {
  return slug.replace(/[%_\\]/g, "");
}

export async function getMobileOrganizerBySlug(
  rawSlug: string,
): Promise<{ organizer: MobileOrganizerPayload | null; requestedSlug: string; normalizedSlug: string }> {
  const requestedSlug = rawSlug.trim();
  const normalizedSlug = normalizePublicOrganizerSlugParam(requestedSlug);
  const db = getDbClient();

  if (!db) {
    throw new Error("Supabase client is not configured");
  }

  const base = () =>
    db
      .from("organizers")
      .select("id,slug,name,description,logo_url,website_url,facebook_url,instagram_url,verified")
      .eq("is_active", true);

  const primary = await base().eq("slug", normalizedSlug).maybeSingle<MobileOrganizerPayload>();
  if (primary.error) {
    throw new Error(primary.error.message);
  }

  if (primary.data) {
    return { organizer: primary.data, requestedSlug, normalizedSlug };
  }

  if (!/[_%]/.test(normalizedSlug)) {
    const fallbackLike = sanitizeSlugForLike(normalizedSlug);
    if (fallbackLike) {
      const secondary = await base().ilike("slug", fallbackLike).limit(2);
      if (secondary.error) {
        throw new Error(secondary.error.message);
      }
      if ((secondary.data ?? []).length === 1) {
        return {
          organizer: secondary.data![0] as MobileOrganizerPayload,
          requestedSlug,
          normalizedSlug,
        };
      }
    }
  }

  return { organizer: null, requestedSlug, normalizedSlug };
}

export async function getCanonicalOrganizerForFestival(
  festivalId: string,
  fallbackOrganizerId: string | null,
): Promise<Pick<MobileOrganizerPayload, "slug" | "name"> | null> {
  const db = getDbClient();
  if (!db) {
    throw new Error("Supabase client is not configured");
  }

  const links = await db
    .from("festival_organizers")
    .select("organizer_id,sort_order")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .returns<Array<{ organizer_id: string | null; sort_order: number | null }>>();

  if (links.error) {
    throw new Error(links.error.message);
  }

  const linkedOrganizerId = links.data?.[0]?.organizer_id ?? null;
  const organizerId = linkedOrganizerId || fallbackOrganizerId;
  if (!organizerId) return null;

  const organizerRow = await db
    .from("organizers")
    .select("slug,name")
    .eq("id", organizerId)
    .eq("is_active", true)
    .maybeSingle<{ slug: string; name: string }>();

  if (organizerRow.error) {
    throw new Error(organizerRow.error.message);
  }

  if (!organizerRow.data) return null;
  return {
    slug: organizerRow.data.slug,
    name: organizerRow.data.name,
  };
}

