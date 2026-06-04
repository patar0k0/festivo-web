/**
 * One-off / repeatable: find and delete orphan objects in the festival hero images bucket.
 *
 * An "orphan" is a Storage object whose public URL is not referenced by any of:
 *   festivals.hero_image / festivals.image_url
 *   pending_festivals.hero_image / pending_festivals.gallery_image_urls (jsonb array)
 *   festival_media.url
 *   organizers.logo_url
 *
 * Deletes via the Storage API (removes both metadata row and the backing blob).
 * Direct SQL DELETE on storage.objects would leak the blob, so do NOT do that.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in .env.local.
 *
 * Run from repo root:
 *   node scripts/cleanup-orphan-hero-images.mjs            # dry-run (lists, deletes nothing)
 *   node scripts/cleanup-orphan-hero-images.mjs --apply    # actually delete
 *   node scripts/cleanup-orphan-hero-images.mjs --apply --min-age-days=7
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images";

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
    const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs() {
  const apply = process.argv.includes("--apply");
  const ageArg = process.argv.find((a) => a.startsWith("--min-age-days="));
  const minAgeDays = ageArg ? Number(ageArg.split("=")[1]) : 0;
  return { apply, minAgeDays: Number.isFinite(minAgeDays) ? minAgeDays : 0 };
}

/** Extract the bucket-relative object path from one of our public hero-bucket URLs. */
function objectPathFromPublicUrl(url, origin) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const prefix = `${origin}/storage/v1/object/public/${BUCKET}/`;
  if (!trimmed.startsWith(prefix)) return null;
  const rest = trimmed.slice(prefix.length);
  if (!rest) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

async function collectReferencedPaths(supabase, origin) {
  const referenced = new Set();
  const add = (url) => {
    const p = objectPathFromPublicUrl(url, origin);
    if (p) referenced.add(p);
  };

  const pageSize = 1000;

  // festivals: hero_image, image_url
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("festivals")
      .select("hero_image, image_url")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`festivals: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) {
      add(r.hero_image);
      add(r.image_url);
    }
    if (data.length < pageSize) break;
  }

  // pending_festivals: hero_image, gallery_image_urls (jsonb array)
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("pending_festivals")
      .select("hero_image, gallery_image_urls")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`pending_festivals: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) {
      add(r.hero_image);
      if (Array.isArray(r.gallery_image_urls)) {
        for (const g of r.gallery_image_urls) add(g);
      }
    }
    if (data.length < pageSize) break;
  }

  // festival_media: url
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("festival_media")
      .select("url")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`festival_media: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) add(r.url);
    if (data.length < pageSize) break;
  }

  // organizers: logo_url (lives in a different bucket normally, but be safe)
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("organizers")
      .select("logo_url")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`organizers: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) add(r.logo_url);
    if (data.length < pageSize) break;
  }

  return referenced;
}

/** Recursively list every object in the bucket (Storage list is per-prefix, max 1000). */
async function listAllObjects(supabase, prefix = "") {
  const out = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have no id/metadata; recurse into them.
      if (entry.id === null || entry.metadata == null) {
        const nested = await listAllObjects(supabase, full);
        out.push(...nested);
      } else {
        out.push({
          path: full,
          size: Number(entry.metadata?.size ?? 0),
          createdAt: entry.created_at ?? null,
        });
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function main() {
  loadEnvFromDotenvLocal();
  const { apply, minAgeDays } = parseArgs();

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
  }
  const origin = rawUrl.replace(/\/$/, "");

  const supabase = createClient(origin, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.info(`Bucket: ${BUCKET}`);
  console.info(`Mode:   ${apply ? "APPLY (will delete)" : "DRY-RUN (no deletion)"}`);
  if (minAgeDays > 0) console.info(`Filter: only orphans older than ${minAgeDays} day(s)`);

  const referenced = await collectReferencedPaths(supabase, origin);
  console.info(`Referenced paths in DB: ${referenced.size}`);

  const objects = await listAllObjects(supabase);
  console.info(`Objects in bucket:      ${objects.length}`);

  const cutoff = minAgeDays > 0 ? Date.now() - minAgeDays * 24 * 60 * 60 * 1000 : null;

  const orphans = objects.filter((o) => {
    if (referenced.has(o.path)) return false;
    if (cutoff !== null) {
      const ts = o.createdAt ? Date.parse(o.createdAt) : 0;
      if (ts && ts > cutoff) return false; // too new — skip (might not be wired into DB yet)
    }
    return true;
  });

  const totalBytes = orphans.reduce((sum, o) => sum + o.size, 0);
  console.info(`\nOrphans found: ${orphans.length} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
  for (const o of orphans) {
    console.info(`  ${o.path}  (${(o.size / 1024).toFixed(1)} KB, ${o.createdAt ?? "?"})`);
  }

  if (!orphans.length) {
    console.info("\nNothing to delete.");
    return;
  }

  if (!apply) {
    console.info("\nDRY-RUN complete. Re-run with --apply to delete the above.");
    return;
  }

  // Delete in batches of 100 via the Storage API.
  const paths = orphans.map((o) => o.path);
  let deleted = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`remove batch ${i}: ${error.message}`);
    deleted += batch.length;
  }
  console.info(`\nDeleted ${deleted} orphan object(s), freed ~${(totalBytes / 1024 / 1024).toFixed(2)} MB.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
