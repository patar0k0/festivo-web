const { createHash } = require("node:crypto");

const DEFAULT_REHOST_OPTIONS = {
  timeoutMs: 10000,
  maxBytes: 8 * 1024 * 1024,
  maxRedirects: 3,
  bucket: process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images",
  allowOriginalOnFailure: false,
};

const FACEBOOK_IMAGE_HOST_PATTERNS = [
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)lookaside\.facebook\.com$/i,
  /(^|\.)lookaside\.fbsbx\.com$/i,
  /(^|\.)scontent\./i,
];

const BULGARIAN_ADDRESS_MARKER_RE = /^\s*(ул|бул|пл)\.?\s+|^\s*ж\.?\s*к\.?\s+/i;
const EXPLICIT_VENUE_NAME_RE = /\b(парк|стадион|читалище|дом\s+на\s+културата)\b/i;

function normalizeISODate(value) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function hasValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function extractDescription({ fbEvent = {}, ogMeta = {} }) {
  const fbDescription = typeof fbEvent.description === "string" ? fbEvent.description.trim() : "";
  if (fbDescription) return fbDescription;

  const ogDescription = typeof ogMeta.description === "string" ? ogMeta.description.trim() : "";
  if (ogDescription) return ogDescription;

  return "";
}

function extractDates({ fbEvent = {}, existing = {} }) {
  const parsedStartDate = normalizeISODate(fbEvent.start_time);
  const parsedEndDate = normalizeISODate(fbEvent.end_time);

  const nextStartDate = parsedStartDate ?? (hasValidDate(existing.start_date) ? existing.start_date : null);
  const nextEndDate = parsedEndDate ?? parsedStartDate ?? (hasValidDate(existing.end_date) ? existing.end_date : null);

  return {
    start_date: nextStartDate,
    end_date: nextEndDate,
  };
}

function extractLocation({ fbEvent = {}, existing = {} }) {
  const place = fbEvent.place && typeof fbEvent.place === "object" ? fbEvent.place : null;
  const placeLocation = place && typeof place.location === "object" ? place.location : null;

  const placeName = typeof place?.name === "string" && place.name.trim() ? place.name.trim() : null;
  const placeStreet = typeof placeLocation?.street === "string" && placeLocation.street.trim() ? placeLocation.street.trim() : null;

  const hasExplicitVenue = placeName ? EXPLICIT_VENUE_NAME_RE.test(placeName) : false;
  const hasAddressMarker = placeName ? BULGARIAN_ADDRESS_MARKER_RE.test(placeName) : false;

  const locationName = hasExplicitVenue
    ? placeName
    : hasAddressMarker
      ? existing.location_name ?? null
      : placeName ?? existing.location_name ?? null;

  const address = hasAddressMarker ? placeName : placeStreet ?? existing.address ?? null;

  const latitude =
    typeof placeLocation?.latitude === "number"
      ? placeLocation.latitude
      : typeof existing.latitude === "number"
        ? existing.latitude
        : null;

  const longitude =
    typeof placeLocation?.longitude === "number"
      ? placeLocation.longitude
      : typeof existing.longitude === "number"
        ? existing.longitude
        : null;

  return {
    location_name: locationName,
    address,
    latitude,
    longitude,
  };
}

function isFacebookImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return FACEBOOK_IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

function extFromContentType(contentType = "") {
  const normalized = String(contentType).toLowerCase().split(";")[0].trim();

  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";

  return null;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fetchImageAsBuffer(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REHOST_OPTIONS.timeoutMs;
  const maxBytes = options.maxBytes ?? DEFAULT_REHOST_OPTIONS.maxBytes;
  const maxRedirects = options.maxRedirects ?? DEFAULT_REHOST_OPTIONS.maxRedirects;

  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: abortController.signal,
        headers: {
          "user-agent": "festivo-ingest-worker/1.0",
          accept: "image/*",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("missing_redirect_location");
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error("invalid_content_type");
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxBytes) {
      throw new Error("image_too_large");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      throw new Error("empty_image");
    }

    if (buffer.length > maxBytes) {
      throw new Error("image_too_large");
    }

    return {
      buffer,
      contentType,
      sourceUrl: currentUrl,
    };
  }

  throw new Error("too_many_redirects");
}

async function uploadHeroImageToStorage({ supabase, imageBuffer, contentType, sourceUrl, bucket }) {
  const extension = extFromContentType(contentType);
  if (!extension) {
    throw new Error("unsupported_content_type");
  }

  const imageHash = hashBuffer(imageBuffer);
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const path = `facebook/${yyyy}/${mm}/${imageHash}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, imageBuffer, {
    contentType,
    upsert: true,
    cacheControl: "31536000",
  });

  if (uploadError) {
    throw new Error(`upload_failed:${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("missing_public_url");
  }

  return {
    storagePath: path,
    publicUrl: data.publicUrl,
    sourceUrl,
  };
}

async function rehostHeroImageIfNeeded({ heroImageUrl, supabase, options = {}, logger = console }) {
  const config = { ...DEFAULT_REHOST_OPTIONS, ...options };
  const original = typeof heroImageUrl === "string" ? heroImageUrl.trim() : "";

  if (!original) return null;

  const detected = isFacebookImageUrl(original);
  logger.log(`[rehost] original=${original} detected=${detected}`);

  if (!detected) {
    return original;
  }

  if (!supabase) {
    logger.log("[rehost] status=fail reason=missing_supabase_client");
    return config.allowOriginalOnFailure ? original : null;
  }

  try {
    const { buffer, contentType, sourceUrl } = await fetchImageAsBuffer(original, config);
    const { storagePath, publicUrl } = await uploadHeroImageToStorage({
      supabase,
      imageBuffer: buffer,
      contentType,
      sourceUrl,
      bucket: config.bucket,
    });

    logger.log(`[rehost] status=ok stored=${storagePath} public=${publicUrl}`);
    return publicUrl;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    logger.log(`[rehost] status=fail reason=${reason}`);
    return config.allowOriginalOnFailure ? original : null;
  }
}

async function buildPendingFestivalPatch({ fbEvent = {}, ogMeta = {}, existing = {}, supabase, rehostOptions = {} }) {
  const description = extractDescription({ fbEvent, ogMeta });
  const dates = extractDates({ fbEvent, existing });
  const location = extractLocation({ fbEvent, existing });

  const originalHeroImage =
    typeof fbEvent.cover?.source === "string" && fbEvent.cover.source.trim()
      ? fbEvent.cover.source.trim()
      : typeof ogMeta.image === "string" && ogMeta.image.trim()
        ? ogMeta.image.trim()
        : existing.hero_image ?? null;

  console.log(`[ingest] hero original=${originalHeroImage ?? ""}`);
  const finalHeroImage = await rehostHeroImageIfNeeded({
    heroImageUrl: originalHeroImage,
    supabase,
    options: rehostOptions,
    logger: console,
  });
  console.log(`[ingest] hero final=${finalHeroImage ?? ""}`);

  const payload = {
    title: typeof fbEvent.name === "string" ? fbEvent.name.trim() : existing.title ?? "",
    description,
    hero_image: finalHeroImage,
    ...dates,
    ...location,
  };

  console.log(`[ingest] title="${payload.title}"`);
  console.log(`[ingest] start_date=${payload.start_date ?? ""}`);
  console.log(`[ingest] location="${payload.location_name ?? ""}"`);
  console.log(`[ingest] persisted hero=${payload.hero_image ?? ""}`);

  return payload;
}

module.exports = {
  buildPendingFestivalPatch,
  extFromContentType,
  extractDates,
  extractDescription,
  extractLocation,
  fetchImageAsBuffer,
  hashBuffer,
  isFacebookImageUrl,
  normalizeISODate,
  rehostHeroImageIfNeeded,
  uploadHeroImageToStorage,
};
