import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";
import { transliteratedSlug } from "@/lib/text/slug";
import { normalizeOrganizerName, normalizeOrganizerNameForMatch } from "@/lib/admin/organizerNormalization";

type OrganizerLookupRow = {
  id: string;
  name: string | null;
};

export { normalizeOrganizerName, normalizeOrganizerNameForMatch };

/** Derived from `organizer_members.status` only (no extra DB columns). */
export type OrganizerOriginKind = "portal" | "pending" | "virtual";

/**
 * portal: at least one active membership (real portal user).
 * pending: no active row, but at least one pending claim.
 * virtual: no active/pending rows (no members, or only revoked).
 */
export function classifyOrganizerOriginFromMembers(
  members: { status: string }[] | null | undefined,
): OrganizerOriginKind {
  const list = members ?? [];
  if (list.some((m) => m.status === "active")) return "portal";
  if (list.some((m) => m.status === "pending")) return "pending";
  return "virtual";
}

export async function pickOrganizerSlug(client: SupabaseClient, baseSlug: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await client.from("organizers").select("id").eq("slug", candidate).eq("is_active", true).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return candidate;
    }
  }

  throw new Error("Failed to generate unique organizer slug");
}

export async function resolveOrCreateOrganizerId(client: SupabaseClient, organizerNameRaw: string) {
  const organizerName = normalizeOrganizerName(organizerNameRaw);
  if (!organizerName) {
    return { organizerId: null, created: false, organizerName: null as string | null };
  }

  const normalizedNeedle = normalizeOrganizerNameForMatch(organizerName);
  if (!normalizedNeedle) {
    return { organizerId: null, created: false, organizerName: null as string | null };
  }

  const { data: organizers, error: organizerLookupError } = await client
    .from("organizers")
    .select("id,name")
    .eq("is_active", true)
    .returns<OrganizerLookupRow[]>();

  if (organizerLookupError) {
    throw new Error(`Organizer lookup failed: ${organizerLookupError.message}`);
  }

  const existing = (organizers ?? []).find((row) => {
    if (!row?.name) return false;
    return normalizeOrganizerNameForMatch(row.name) === normalizedNeedle;
  });

  if (existing?.id) {
    return { organizerId: existing.id, created: false, organizerName };
  }

  const slugBase = transliteratedSlug(organizerName) || slugify(organizerName);
  if (!slugBase) {
    throw new Error("Could not generate organizer slug");
  }

  const slug = await pickOrganizerSlug(client, slugBase);
  const { data: inserted, error: insertError } = await client
    .from("organizers")
    .insert({ name: organizerName, slug })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Organizer create failed: ${insertError.message}`);
  }

  return { organizerId: inserted.id, created: true, organizerName };
}
