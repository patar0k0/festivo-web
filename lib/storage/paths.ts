function supabasePublicOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!raw) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }
  return raw.replace(/\/$/, "");
}

export const ORGANIZER_LOGOS_BUCKET = process.env.SUPABASE_ORGANIZER_LOGOS_BUCKET || "organizer-logos";

const LOGO_OBJECT_PATH_RE = /^logos\/([a-f0-9]{64})\.webp$/i;

export type StorageFile = {
  bucket: string;
  path: string;
  publicUrl: string;
};

export function organizerLogo(hash: string): StorageFile {
  const path = `logos/${hash}.webp`;
  const bucket = ORGANIZER_LOGOS_BUCKET;

  return {
    bucket,
    path,
    publicUrl: `${supabasePublicOrigin()}/storage/v1/object/public/${bucket}/${path}`,
  };
}

/**
 * Parses a decoded storage object path from our public URL. If it matches the
 * content-addressed organizer logo layout, returns the canonical {@link organizerLogo} descriptor.
 * Otherwise null (do not delete using arbitrary URL paths).
 */
export function organizerLogoFromValidatedStoragePath(objectPath: string): StorageFile | null {
  const m = LOGO_OBJECT_PATH_RE.exec(objectPath.trim());
  if (!m) return null;
  return organizerLogo(m[1].toLowerCase());
}
