import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSettlementInput } from "@/lib/settlements/normalizeSettlementInput";

export { normalizeSettlementInput };

export type ResolvedCity = {
  id: number;
  slug: string;
  name_bg: string;
};

const BG_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};

function citySlugFromName(name: string) {
  const lowered = name.toLocaleLowerCase("bg-BG");
  const transliterated = [...lowered]
    .map((char) => {
      if (char in BG_TO_LATIN) return BG_TO_LATIN[char];
      return /[a-z0-9]/.test(char) ? char : " ";
    })
    .join("");

  const slug = transliterated
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "city";
}

async function findCityByExactName(client: SupabaseClient, name: string): Promise<ResolvedCity | null> {
  const byName = await client.from("cities").select("id,slug,name_bg").ilike("name_bg", name).limit(10);
  if (byName.error) {
    throw new Error(`City lookup by name failed: ${byName.error.message}`);
  }

  const normalizedLower = name.toLocaleLowerCase("bg-BG");
  const exactName = (byName.data ?? []).find((city) => city.name_bg.toLocaleLowerCase("bg-BG") === normalizedLower);
  return (exactName ?? null) as ResolvedCity | null;
}

async function pickAvailableSlug(client: SupabaseClient, baseSlug: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await client.from("cities").select("id").eq("slug", candidate).maybeSingle();
    if (error) {
      throw new Error(`City slug lookup failed: ${error.message}`);
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Failed to generate unique city slug.");
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

  const exactName = await findCityByExactName(client, normalizedInput);
  if (exactName) {
    return exactName;
  }

  const byName = await client.from("cities").select("id,slug,name_bg").ilike("name_bg", normalizedInput).limit(5);
  if (byName.error) {
    throw new Error(`City lookup by name failed: ${byName.error.message}`);
  }

  return (byName.data?.[0] ?? null) as ResolvedCity | null;
}

export async function resolveOrCreateCityReference(client: SupabaseClient, input: string): Promise<{ city: ResolvedCity; created: boolean } | null> {
  const normalizedInput = normalizeSettlementInput(input);

  if (!normalizedInput) {
    return null;
  }

  const resolved = await resolveCityReference(client, normalizedInput);
  if (resolved) {
    return { city: resolved, created: false };
  }

  const existingByName = await findCityByExactName(client, normalizedInput);
  if (existingByName) {
    return { city: existingByName, created: false };
  }

  const adminClient = createSupabaseAdmin();

  const resolvedViaAdmin = await resolveCityReference(adminClient, normalizedInput);
  if (resolvedViaAdmin) {
    return { city: resolvedViaAdmin, created: false };
  }

  const existingByNameViaAdmin = await findCityByExactName(adminClient, normalizedInput);
  if (existingByNameViaAdmin) {
    return { city: existingByNameViaAdmin, created: false };
  }

  const baseSlug = citySlugFromName(normalizedInput);
  const slug = await pickAvailableSlug(adminClient, baseSlug);

  const inserted = await adminClient.from("cities").insert({ name_bg: normalizedInput, slug }).select("id,slug,name_bg").single();
  if (inserted.error) {
    throw new Error(`City insert failed: ${inserted.error.message}`);
  }

  return { city: inserted.data as ResolvedCity, created: true };
}
