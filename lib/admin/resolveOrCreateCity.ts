import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";
import { applySettlementTypeInferenceForResolvedCity } from "@/lib/settlements/applySettlementTypeInference";
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

function capitalizeCityWord(word: string) {
  if (!word) {
    return "";
  }

  const lowered = word.toLocaleLowerCase("bg-BG");
  const [first = "", ...rest] = lowered;
  return `${first.toLocaleUpperCase("bg-BG")}${rest.join("")}`;
}

export function normalizeCityDisplayName(value: string) {
  return normalizeCityInput(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => capitalizeCityWord(word))
    .join(" ");
}

function normalizeForCompare(value: string) {
  return normalizeCityInput(value).toLocaleLowerCase("bg-BG");
}

function slugToComparableName(slug: string) {
  return slug.replace(/-/g, " ").toLocaleLowerCase("bg-BG");
}

function shouldRepairCityName(city: CityRow, displayName: string) {
  const existingName = normalizeForCompare(city.name_bg);
  const expectedName = normalizeForCompare(displayName);
  const slugComparable = slugToComparableName(city.slug);

  return existingName !== expectedName && existingName === slugComparable;
}

async function updateCityName(client: SupabaseClient, cityId: number, displayName: string) {
  const { data, error } = await client
    .from("cities")
    .update({ name_bg: displayName })
    .eq("id", cityId)
    .select("id,slug,name_bg")
    .maybeSingle();

  if (error) {
    throw new Error(`City name repair failed: ${error.message}`);
  }

  return (data ?? null) as CityRow | null;
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
  const displayName = normalizeCityDisplayName(normalizedInput);

  if (!normalizedInput) {
    return { city: null, created: false, normalizedInput, displayName, slug: "" };
  }

  const slug = slugify(displayName).toLowerCase();
  if (!slug) {
    throw new Error("City slug is empty");
  }

  const adminClient = createSupabaseAdmin();

  const cityBySlug = await findCityBySlug(adminClient, slug);
  if (cityBySlug) {
    if (shouldRepairCityName(cityBySlug, displayName)) {
      const repairedCity = await updateCityName(adminClient, cityBySlug.id, displayName);
      if (repairedCity) {
        await applySettlementTypeInferenceForResolvedCity(repairedCity.id, displayName);
        return { city: repairedCity, created: false, normalizedInput, displayName, slug };
      }
    }

    await applySettlementTypeInferenceForResolvedCity(cityBySlug.id, displayName);
    return { city: cityBySlug, created: false, normalizedInput, displayName, slug };
  }

  const cityByName = await findCityByName(adminClient, displayName);
  if (cityByName) {
    await applySettlementTypeInferenceForResolvedCity(cityByName.id, displayName);
    return { city: cityByName, created: false, normalizedInput, displayName, slug };
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("cities")
    .insert({
      name_bg: displayName,
      slug,
    })
    .select("id,slug,name_bg")
    .maybeSingle();

  if (!insertError && inserted) {
    await applySettlementTypeInferenceForResolvedCity((inserted as CityRow).id, displayName);
    return { city: inserted as CityRow, created: true, normalizedInput, displayName, slug };
  }

  if (insertError?.code === "23505") {
    const cityAfterConflict = await findCityBySlug(adminClient, slug);
    if (cityAfterConflict) {
      if (shouldRepairCityName(cityAfterConflict, displayName)) {
        const repairedCity = await updateCityName(adminClient, cityAfterConflict.id, displayName);
        if (repairedCity) {
          await applySettlementTypeInferenceForResolvedCity(repairedCity.id, displayName);
          return { city: repairedCity, created: false, normalizedInput, displayName, slug };
        }
      }

      await applySettlementTypeInferenceForResolvedCity(cityAfterConflict.id, displayName);
      return { city: cityAfterConflict, created: false, normalizedInput, displayName, slug };
    }
  }

  throw new Error(`City insert failed: ${insertError?.message ?? "unknown error"}`);
}
