/**
 * One-time script: updates `cities.is_village` from EKATTE 2025 JSON data.
 *
 * Usage:
 *   npx tsx scripts/update-city-types-from-ekatte.ts <path-to-ek_atte.json>
 *
 * Example:
 *   npx tsx scripts/update-city-types-from-ekatte.ts C:/Users/User/Downloads/Ekatte-2025-json/ek_atte.json
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EkatteEntry = {
  ekatte: string;
  t_v_m: string; // "с." | "гр." | "м."
  name: string;
  name_en?: string;
  oblast_name?: string;
  obshtina_name?: string;
};

type CityRow = {
  slug: string;
  name_bg: string;
  is_village: boolean | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip common Bulgarian settlement prefixes for matching. */
function stripPrefix(name: string): string {
  return name
    .trim()
    .replace(/^(?:гр\.\s*|град\s+|с\.\s*|село\s+|к\.к\.\s*|к\.к\s+|кк\s+)/iu, "")
    .trim()
    .toLowerCase();
}

function ekatteIsVillage(t_v_m: string): boolean {
  // "гр." → false (город), "с." и "м." (манастир) → true
  return t_v_m.trim() !== "гр.";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const ekattePath = process.argv[2];
  if (!ekattePath) {
    console.error("Usage: npx tsx scripts/update-city-types-from-ekatte.ts <path-to-ek_atte.json>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Load EKATTE
  console.log(`\nLoading EKATTE from ${ekattePath}...`);
  const raw = fs.readFileSync(ekattePath, "utf-8");
  const ekatte: EkatteEntry[] = JSON.parse(raw);
  console.log(`  ${ekatte.length} entries loaded.`);

  // 2. Build lookup: normalizedName → [{is_village, oblast, obshtina}]
  type EkLookupEntry = { is_village: boolean; t_v_m: string; oblast: string; obshtina: string; ekatte: string };
  const lookup = new Map<string, EkLookupEntry[]>();

  for (const entry of ekatte) {
    // Skip metadata rows (the JSON includes a trailing metadata object without name/t_v_m)
    if (!entry.name || !entry.t_v_m) continue;
    const key = entry.name.toLowerCase().trim();
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push({
      is_village: ekatteIsVillage(entry.t_v_m),
      t_v_m: entry.t_v_m.trim(),
      oblast: entry.oblast_name ?? "",
      obshtina: entry.obshtina_name ?? "",
      ekatte: entry.ekatte,
    });
  }

  // 3. Fetch all cities from Supabase
  console.log("\nFetching cities from Supabase...");
  const { data: cities, error } = await supabase
    .from("cities")
    .select("slug, name_bg, is_village")
    .returns<CityRow[]>();

  if (error || !cities) {
    console.error("Failed to fetch cities:", error?.message);
    process.exit(1);
  }
  console.log(`  ${cities.length} cities found.`);

  // 4. Match and classify
  const toUpdate: { slug: string; is_village: boolean; matched_ekatte?: string }[] = [];
  const ambiguous: { slug: string; name_bg: string; matches: EkLookupEntry[] }[] = [];
  const notFound: { slug: string; name_bg: string }[] = [];
  const alreadyCorrect: string[] = [];

  for (const city of cities) {
    const key = stripPrefix(city.name_bg);
    const matches = lookup.get(key);

    if (!matches || matches.length === 0) {
      notFound.push({ slug: city.slug, name_bg: city.name_bg });
      continue;
    }

    // Check if all matches agree on type
    const uniqueTypes = [...new Set(matches.map((m) => m.is_village))];

    if (uniqueTypes.length === 1) {
      // All matches agree
      const is_village = uniqueTypes[0];
      if (city.is_village === is_village) {
        alreadyCorrect.push(city.slug);
      } else {
        toUpdate.push({ slug: city.slug, is_village, matched_ekatte: matches[0].ekatte });
      }
    } else {
      // Conflict: same name is city in one region, village in another
      ambiguous.push({ slug: city.slug, name_bg: city.name_bg, matches });
    }
  }

  // 5. Report plan
  console.log("\n=== UPDATE PLAN ===");
  console.log(`  Will update:        ${toUpdate.length}`);
  console.log(`  Already correct:    ${alreadyCorrect.length}`);
  console.log(`  Ambiguous (manual): ${ambiguous.length}`);
  console.log(`  Not found in NSI:   ${notFound.length}`);

  if (ambiguous.length > 0) {
    console.log("\n=== AMBIGUOUS (need manual review) ===");
    for (const a of ambiguous) {
      const types = a.matches.map((m) => `${m.t_v_m} ${m.oblast}`).join(" | ");
      console.log(`  [${a.slug}] "${a.name_bg}" → ${types}`);
    }
  }

  if (notFound.length > 0) {
    console.log("\n=== NOT FOUND in EKATTE ===");
    for (const nf of notFound) {
      console.log(`  [${nf.slug}] "${nf.name_bg}"`);
    }
  }

  if (toUpdate.length === 0) {
    console.log("\nNothing to update. Done.");
    return;
  }

  console.log("\n=== UPDATES ===");
  for (const u of toUpdate) {
    const city = cities.find((c) => c.slug === u.slug)!;
    const before = city.is_village === true ? "с." : city.is_village === false ? "гр." : "null";
    const after = u.is_village ? "с." : "гр.";
    console.log(`  [${u.slug}] "${city.name_bg}": ${before} → ${after}`);
  }

  // 6. Confirm
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`\nProceed with ${toUpdate.length} updates? (yes/no): `, resolve);
  });
  rl.close();

  if (!["yes", "y"].includes(answer.trim().toLowerCase())) {
    console.log("Aborted.");
    return;
  }

  // 7. Apply updates in batches of 50
  console.log("\nApplying updates...");
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toUpdate.length; i += 50) {
    const batch = toUpdate.slice(i, i + 50);
    for (const u of batch) {
      const { error } = await supabase
        .from("cities")
        .update({ is_village: u.is_village })
        .eq("slug", u.slug);
      if (error) {
        console.error(`  ERROR updating [${u.slug}]: ${error.message}`);
        errorCount++;
      } else {
        successCount++;
      }
    }
  }

  console.log(`\n✅ Done: ${successCount} updated, ${errorCount} errors`);
  if (ambiguous.length > 0) {
    console.log(`⚠️  ${ambiguous.length} ambiguous entries need manual review (listed above)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
