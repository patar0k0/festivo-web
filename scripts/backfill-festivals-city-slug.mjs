/**
 * One-off: set `festivals.city_slug` from `festivals.city` using the same rules as `lib/text/slugifyCity.ts`.
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) in `.env.local`.
 *
 * Run from repo root:
 *   node scripts/backfill-festivals-city-slug.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFromDotenvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line
      .slice(eqIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function slugifyCity(input) {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  loadEnvFromDotenvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pageSize = 500;
  let offset = 0;
  let updated = 0;

  for (;;) {
    const { data, error } = await supabase.from("festivals").select("id, city").range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) break;

    for (const row of data) {
      const id = row.id;
      const city = row.city;
      const citySlug =
        typeof city === "string" && city.trim().length > 0 ? slugifyCity(city) || null : null;

      const { error: upErr } = await supabase.from("festivals").update({ city_slug: citySlug }).eq("id", id);

      if (upErr) {
        throw new Error(`update ${id}: ${upErr.message}`);
      }
      updated += 1;
    }

    offset += pageSize;
  }

  console.info(`backfill-festivals-city-slug: updated ${updated} row(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
