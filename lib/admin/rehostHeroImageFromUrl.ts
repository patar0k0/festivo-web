import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";

const HERO_IMAGES_BUCKET = process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images";
const MAX_HERO_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 5;

export function getHeroImagesBucketName() {
  return HERO_IMAGES_BUCKET;
}

function normalizeSupabaseProjectUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function isAlreadyOurSupabaseHeroPublicUrl(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  const projectUrl = normalizeSupabaseProjectUrl();
  if (!projectUrl) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  let project: URL;
  try {
    project = new URL(projectUrl);
  } catch {
    return false;
  }
  if (parsed.origin !== project.origin) return false;
  const marker = `/storage/v1/object/public/${HERO_IMAGES_BUCKET}/`;
  return parsed.pathname.includes(marker);
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

/** When servers send application/octet-stream or omit Content-Type, infer from magic bytes. */
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

function responseBodyLooksLikeHtml(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(512, buf.length)).toString("utf8").trimStart().toLowerCase();
  return (
    sample.startsWith("<!doctype") ||
    sample.startsWith("<html") ||
    sample.startsWith("<head") ||
    sample.startsWith("<!--") ||
    sample.startsWith("<script")
  );
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
          "user-agent": "festivo-admin-hero-import/1.0",
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
    if (contentLength > MAX_HERO_IMAGE_BYTES) {
      throw new Error(`Image is too large (max ${Math.floor(MAX_HERO_IMAGE_BYTES / (1024 * 1024))}MB).`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      throw new Error("Downloaded image is empty.");
    }

    if (buffer.length > MAX_HERO_IMAGE_BYTES) {
      throw new Error(`Image is too large (max ${Math.floor(MAX_HERO_IMAGE_BYTES / (1024 * 1024))}MB).`);
    }

    const headerLooksImage = headerContentType.toLowerCase().trim().startsWith("image/");
    let effectiveContentType = headerContentType;

    if (!headerLooksImage) {
      const sniffed = sniffImageMimeFromBuffer(buffer);
      if (sniffed) {
        effectiveContentType = sniffed;
      } else if (responseBodyLooksLikeHtml(buffer)) {
        throw new Error(
          "The URL returned HTML instead of an image. Facebook and similar CDNs often do this for server-side requests (login wall or bot block). Try uploading the file manually, or rely on ingest rehosting with a browser session.",
        );
      } else {
        const ct = headerContentType.trim() || "missing";
        throw new Error(`URL did not return a recognizable image (Content-Type: ${ct}).`);
      }
    }

    return { buffer, contentType: effectiveContentType };
  }

  throw new Error("Too many redirects while downloading the image.");
}

export type RehostHeroImageResult =
  | { ok: true; publicUrl: string; originalUrl: string | null }
  | { ok: false; error: string };

/**
 * If `sourceUrl` is already a public URL in our hero bucket, returns it unchanged.
 * Otherwise downloads the image (with basic SSRF protection) and uploads it to Storage.
 */
export async function rehostHeroImageIfRemote(
  supabase: SupabaseClient,
  sourceUrl: string,
  buildObjectPath: (extension: string) => string,
): Promise<RehostHeroImageResult> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "No image URL provided." };
  }

  if (isAlreadyOurSupabaseHeroPublicUrl(trimmed)) {
    return { ok: true, publicUrl: trimmed, originalUrl: null };
  }

  try {
    const { buffer, contentType } = await fetchRemoteImage(trimmed);
    const extension = extensionFromMimeType(contentType);
    if (!extension) {
      return { ok: false, error: "Unsupported image type." };
    }

    const objectPath = buildObjectPath(extension);

    const { error: uploadError } = await supabase.storage.from(HERO_IMAGES_BUCKET).upload(objectPath, buffer, {
      upsert: false,
      contentType: contentType.split(";")[0]?.trim() || `image/${extension}`,
      cacheControl: "3600",
    });

    if (uploadError) {
      return { ok: false, error: `Upload failed: ${uploadError.message}` };
    }

    const { data: publicData } = supabase.storage.from(HERO_IMAGES_BUCKET).getPublicUrl(objectPath);
    const publicUrl = publicData?.publicUrl ?? null;
    if (!publicUrl) {
      return { ok: false, error: "Could not get public URL for uploaded image." };
    }

    return { ok: true, publicUrl, originalUrl: trimmed };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import image from URL.";
    return { ok: false, error: message };
  }
}

export function uniqueResearchHeroObjectPath(extension: string): string {
  return `research-ai/${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
}
