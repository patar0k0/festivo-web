import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export type CityRow = {
  id: number;
  slug: string;
  name_bg: string;
};

function normalizeCityInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toDisplayCityName(value: string) {
  const lowered = value.toLocaleLowerCase("bg-BG");
  const [first = "", ...rest] = lowered;
  return `${first.toLocaleUpperCase("bg-BG")}${rest.join("")}`;
}

async function findCityBySlug(client: SupabaseClient, slug: string) {
  const { data, error } = await client.from("cities").select("id,slug,name_bg").eq("slug", slug).maybeSingle();

  if (error) {
    throw new Error(`City slug lookup failed: ${error.message}`);
  }

  return (data ?? null) as CityRow | null;
}

async function findCityByName(client: SupabaseClient, name: string) {
  const { data, error } = await client.from("cities").select("id,slug,name_bg").ilike("name_bg", name).limit(5);

  if (error) {
    throw new Error(`City name lookup failed: ${error.message}`);
  }

  const exact = (data ?? []).find((city) => city.name_bg.toLocaleLowerCase("bg-BG") === name.toLocaleLowerCase("bg-BG"));
  return ((exact ?? data?.[0]) ?? null) as CityRow | null;
}

export async function resolveOrCreateCity(input: string) {
  const normalizedInput = normalizeCityInput(input);

  if (!normalizedInput) {
    return { city: null, created: false, normalizedInput, slug: "" };
  }

  const slug = slugify(normalizedInput).toLowerCase();
  if (!slug) {
    throw new Error("City slug is empty");
  }

  const adminClient = createSupabaseAdmin();

  const cityBySlug = await findCityBySlug(adminClient, slug);
  if (cityBySlug) {
    return { city: cityBySlug, created: false, normalizedInput, slug };
  }

  const cityByName = await findCityByName(adminClient, normalizedInput);
  if (cityByName) {
    return { city: cityByName, created: false, normalizedInput, slug };
  }

  const displayName = toDisplayCityName(normalizedInput);

  const { data: inserted, error: insertError } = await adminClient
    .from("cities")
    .insert({
      name_bg: displayName,
      slug,
    })
    .select("id,slug,name_bg")
    .maybeSingle();

  if (!insertError && inserted) {
    return { city: inserted as CityRow, created: true, normalizedInput, slug };
  }

  if (insertError?.code === "23505") {
    const cityAfterConflict = await findCityBySlug(adminClient, slug);
    if (cityAfterConflict) {
      return { city: cityAfterConflict, created: false, normalizedInput, slug };
    }
  }

  throw new Error(`City insert failed: ${insertError?.message ?? "unknown error"}`);
}

