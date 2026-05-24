import { lookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ORGANIZER_LOGOS_BUCKET,
  organizerLogo,
  organizerLogoFromValidatedStoragePath,
} from "@/lib/storage/paths";
import { STORAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage/cacheControl";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 5;
const LOGO_MAX_WIDTH_PX = 512;
const LOGO_MAX_HEIGHT_PX = 512;
const WEBP_QUALITY = 80;
const UPLOAD_CACHE_CONTROL = STORAGE_UPLOAD_CACHE_CONTROL;
const LOGO_UPLOAD_RATE_LIMIT_MAX_PER_MINUTE = 10;

const logoUploadRateLimitMap = new Map<string, number>();

async function organizerLogoAlreadyExistsInStorage(
  storage: ReturnType<typeof createSupabaseAdmin>["storage"],
  bucket: string,
  hash: string,
): Promise<boolean> {
  const { data: existing, error } = await storage.from(bucket).list("logos", { search: `${hash}.webp` });
  if (error) {
    throw new Error(`Failed to check existing organizer logo object: ${error.message}`);
  }
  return (existing?.length ?? 0) > 0;
}

function normalizeSupabaseProjectUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function isBlockedIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "127.0.0.1" || lower === "0.0.0.0" || lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;

  if (isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 0) return true;
  }

  return false;
}

async function assertSafeRemoteUrl(urlStr: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error("Invalid image URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) image URLs are allowed.");
  }

  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Localhost URLs are not allowed.");
  }

  const ipv6Literal = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (isIPv4(host) || isIPv6(ipv6Literal)) {
    if (isBlockedIp(isIPv6(ipv6Literal) ? ipv6Literal : host)) {
      throw new Error("Private or local addresses are not allowed.");
    }
    return url;
  }

  const { address } = await lookup(host, { verbatim: true });
  const addr = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
  if (isBlockedIp(addr)) {
    throw new Error("URL resolves to a private or local address.");
  }

  return url;
}

function extensionFromMimeType(mimeType: string): string | null {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/svg+xml") return "svg";
  return null;
}

function sniffImageMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function isAlreadyOurOrganizerLogoPublicUrl(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  const projectUrl = normalizeSupabaseProjectUrl();
  if (!projectUrl) return false;

  let parsed: URL;
  let project: URL;
  try {
    parsed = new URL(trimmed);
    project = new URL(projectUrl);
  } catch {
    return false;
  }

  if (parsed.origin !== project.origin) return false;
  const prefix = `/storage/v1/object/public/${ORGANIZER_LOGOS_BUCKET}/`;
  return parsed.pathname.startsWith(prefix);
}

function organizerLogoStoragePathFromPublicUrl(publicUrl: string): string | null {
  const trimmed = publicUrl.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const prefix = `/storage/v1/object/public/${ORGANIZER_LOGOS_BUCKET}/`;
  if (!parsed.pathname.startsWith(prefix)) return null;
  const encoded = parsed.pathname.slice(prefix.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function isAlreadyExistsError(err: unknown): boolean {
  return String(err).toLowerCase().includes("exists");
}

async function fetchRemoteImage(urlStr: string): Promise<{ buffer: Buffer; contentType: string }> {
  let currentUrl = urlStr;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeRemoteUrl(currentUrl);

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: abortController.signal,
        headers: {
          "user-agent": "festivo-admin-organizer-logo-import/1.0",
          accept: "image/*,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Image server returned a redirect without a location.");
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Could not download image (HTTP ${response.status}).`);
    }

    const headerContentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large (max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB).`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new Error("Downloaded image is empty.");
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large (max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB).`);
    }

    const headerLooksImage = headerContentType.toLowerCase().trim().startsWith("image/");
    if (!headerLooksImage) {
      const sniffed = sniffImageMimeFromBuffer(buffer);
      if (!sniffed) {
        throw new Error("URL did not return a recognizable image.");
      }
      return { buffer, contentType: sniffed };
    }

    return { buffer, contentType: headerContentType };
  }

  throw new Error("Too many redirects while downloading the image.");
}

async function rasterizeOrganizerLogoToWebp(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, {
      limitInputPixels: 4096 * 4096,
    })
      .rotate()
      .resize({
        width: LOGO_MAX_WIDTH_PX,
        height: LOGO_MAX_HEIGHT_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown";
    throw new Error(`Could not process organizer logo image: ${message}`);
  }
}

/**
 * Best-effort removal of a previously stored organizer logo. No-op if the URL is not
 * an organizer-logo public object for this project. Logs failures; does not throw.
 */
export async function deleteOrganizerLogoFromStorageIfOwned(
  publicUrl: string | null | undefined,
  expectedUrl?: string | null,
): Promise<void> {
  if (!publicUrl?.trim()) return;
  const trimmed = publicUrl.trim();
  const expectedTrimmed = expectedUrl?.trim();
  if (expectedTrimmed && trimmed !== expectedTrimmed) return;
  if (!isAlreadyOurOrganizerLogoPublicUrl(trimmed)) return;

  const decodedPath = organizerLogoStoragePathFromPublicUrl(trimmed);
  if (!decodedPath) return;

  const file = organizerLogoFromValidatedStoragePath(decodedPath);
  if (!file) return;

  try {
    const supabase = createSupabaseAdmin();
    const { data: rows, error: countError } = await supabase
      .from("organizers")
      .select("id")
      .eq("logo_url", trimmed)
      .limit(2);
    if (countError) {
      console.error("[organizer-logo] Failed to verify shared storage object usage", {
        objectPath: file.path,
        message: countError.message,
      });
      return;
    }
    if ((rows?.length ?? 0) > 1) {
      return;
    }

    const { error } = await supabase.storage.from(file.bucket).remove([file.path]);
    if (error) {
      console.error("[organizer-logo] Failed to remove storage object", { objectPath: file.path, message: error.message });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[organizer-logo] Failed to remove storage object", { objectPath: file.path, message });
  }
}

export function takeOrganizerLogoUploadRateLimit(ipKey: string | null | undefined): boolean {
  const ip = ipKey?.trim() || "unknown";
  const nowBucket = Math.floor(Date.now() / 60000);
  for (const mapKey of logoUploadRateLimitMap.keys()) {
    const colon = mapKey.lastIndexOf(":");
    const bucket = colon === -1 ? NaN : Number(mapKey.slice(colon + 1));
    if (Number.isFinite(bucket) && nowBucket - bucket > 2) {
      logoUploadRateLimitMap.delete(mapKey);
    }
  }
  const key = `${ip}:${nowBucket}`;
  const count = (logoUploadRateLimitMap.get(key) ?? 0) + 1;
  logoUploadRateLimitMap.set(key, count);
  return count > LOGO_UPLOAD_RATE_LIMIT_MAX_PER_MINUTE;
}

export async function normalizeImageToLocalStorage(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (isAlreadyOurOrganizerLogoPublicUrl(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return trimmed;
  }

  const { buffer, contentType } = await fetchRemoteImage(trimmed);
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("Image too large");
  }
  const extension = extensionFromMimeType(contentType);
  if (!extension) {
    throw new Error("Unsupported organizer logo image type.");
  }

  const webpBuffer = await rasterizeOrganizerLogoToWebp(buffer);
  if (!webpBuffer.length) {
    throw new Error("Processed organizer logo is empty.");
  }

  const hash = createHash("sha256").update(webpBuffer).digest("hex");
  const file = organizerLogo(hash);
  const supabase = createSupabaseAdmin();
  if (await organizerLogoAlreadyExistsInStorage(supabase.storage, file.bucket, hash)) {
    return file.publicUrl;
  }
  try {
    const { error: uploadError } = await supabase.storage.from(file.bucket).upload(file.path, webpBuffer, {
      contentType: "image/webp",
      cacheControl: UPLOAD_CACHE_CONTROL,
    });
    if (uploadError) {
      if (!isAlreadyExistsError(uploadError)) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }
  } catch (err) {
    if (!isAlreadyExistsError(err)) {
      throw err;
    }
  }

  return file.publicUrl;
}

/** Portal upload: same WebP pipeline as URL import; max 2MB to match client validation. */
const MAX_PORTAL_ORGANIZER_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function uploadOrganizerLogoFromUploadedBuffer(buffer: Buffer, claimedContentType: string): Promise<string> {
  if (buffer.length > MAX_PORTAL_ORGANIZER_LOGO_UPLOAD_BYTES) {
    throw new Error("Image is too large (max 2MB).");
  }
  if (!buffer.length) {
    throw new Error("Empty file.");
  }

  let mime = claimedContentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!mime.startsWith("image/")) {
    mime = sniffImageMimeFromBuffer(buffer) ?? "";
  }

  const extension = extensionFromMimeType(mime);
  if (!extension) {
    throw new Error("Unsupported organizer logo image type.");
  }

  const webpBuffer = await rasterizeOrganizerLogoToWebp(buffer);
  if (!webpBuffer.length) {
    throw new Error("Processed organizer logo is empty.");
  }

  const hash = createHash("sha256").update(webpBuffer).digest("hex");
  const file = organizerLogo(hash);
  const supabase = createSupabaseAdmin();
  if (await organizerLogoAlreadyExistsInStorage(supabase.storage, file.bucket, hash)) {
    return file.publicUrl;
  }
  try {
    const { error: uploadError } = await supabase.storage.from(file.bucket).upload(file.path, webpBuffer, {
      contentType: "image/webp",
      cacheControl: UPLOAD_CACHE_CONTROL,
    });
    if (uploadError) {
      if (!isAlreadyExistsError(uploadError)) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }
  } catch (err) {
    if (!isAlreadyExistsError(err)) {
      throw err;
    }
  }

  return file.publicUrl;
}
