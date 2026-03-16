import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

export type ResolvedCity = {
  id: number;
  slug: string;
  name_bg: string;
};

export function normalizeSettlementInput(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return "";
  }

  // Strip common Bulgarian locality prefixes at the beginning (e.g. "с. ", "гр. ").
  // Keep this conservative to avoid changing unrelated free-form location strings.
  return trimmed.replace(/^(?:гр|град|с|село)\.?\s+/i, "");
}

export async function resolveCityReference(client: SupabaseClient, input: string): Promise<ResolvedCity | null> {
  const normalizedInput = normalizeSettlementInput(input);

  if (!normalizedInput) {
    return null;
  }

  if (/^\d+$/.test(normalizedInput)) {
    const { data, error } = await client.from("cities").select("id,slug,name_bg").eq("id", Number(normalizedInput)).maybeSingle();
    if (error) {
      throw new Error(`City lookup by id failed: ${error.message}`);
    }

    return (data ?? null) as ResolvedCity | null;
  }

  const normalizedLower = normalizedInput.toLocaleLowerCase("bg-BG");

  const bySlug = await client.from("cities").select("id,slug,name_bg").eq("slug", normalizedLower).limit(1);
  if (bySlug.error) {
    throw new Error(`City lookup by slug failed: ${bySlug.error.message}`);
  }

  if (bySlug.data?.[0]) {
    return bySlug.data[0] as ResolvedCity;
  }

  const byName = await client.from("cities").select("id,slug,name_bg").ilike("name_bg", normalizedInput).limit(5);
  if (byName.error) {
    throw new Error(`City lookup by name failed: ${byName.error.message}`);
  }

  const exactName = (byName.data ?? []).find((city) => city.name_bg.toLocaleLowerCase("bg-BG") === normalizedLower);
  return (exactName ?? byName.data?.[0] ?? null) as ResolvedCity | null;
}
