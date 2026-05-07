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

const HARD_REJECT_URL_PATTERNS = [
  /(?:^|[\/_-])logo(?:[\/_-]|$)/i,
  /(?:^|[\/_-])icon(?:[\/_-]|$)/i,
  /(?:^|[\/_-])sprite(?:[\/_-]|$)/i,
  /(?:^|[\/_-])avatar(?:[\/_-]|$)/i,
  /(?:^|[\/_-])profile(?:[\/_-]|$)/i,
  /(?:^|[\/_-])pixel(?:[\/_-]|$)/i,
  /(?:^|[\/_-])tracking(?:[\/_-]|$)/i,
  /[?&](?:shim|__tn__|_nc_cat)=/i,
];

const SOFT_MIN_WIDTH = 720;
const SOFT_MIN_HEIGHT = 405;
const HARD_MIN_SIDE = 96;
const HARD_MIN_AREA = 12000;
const MAX_CANDIDATES = 10;

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

function toPositiveNumber(value) {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return null;
  return next;
}

function collectHeroImageCandidates({ fbEvent = {}, ogMeta = {}, existing = {} }) {
  const candidates = [];
  const push = (url, source, extras = {}) => {
    if (typeof url !== "string" || !url.trim()) return;
    const normalized = url.trim();
    if (candidates.some((candidate) => candidate.url === normalized)) return;
    candidates.push({
      url: normalized,
      source,
      width: toPositiveNumber(extras.width),
      height: toPositiveNumber(extras.height),
    });
  };

  push(fbEvent.cover?.source, "facebook_cover", {
    width: fbEvent.cover?.width,
    height: fbEvent.cover?.height,
  });
  push(ogMeta.image, "og:image", { width: ogMeta.imageWidth, height: ogMeta.imageHeight });
  const ogImages = Array.isArray(ogMeta.images) ? ogMeta.images : [];
  for (const ogImage of ogImages.slice(0, 4)) {
    if (typeof ogImage === "string") {
      push(ogImage, "og:image_alt");
      continue;
    }
    if (ogImage && typeof ogImage === "object") {
      push(ogImage.url || ogImage.secure_url, "og:image_alt", {
        width: ogImage.width,
        height: ogImage.height,
      });
    }
  }

  const jsonLdImages = Array.isArray(ogMeta.jsonLdImages) ? ogMeta.jsonLdImages : [];
  for (const image of jsonLdImages.slice(0, 3)) {
    push(image, "jsonld:image");
  }

  push(existing.hero_image, "existing_pending");

  return candidates.slice(0, MAX_CANDIDATES);
}

function getFacebookUpgradedUrl(url) {
  if (!isFacebookImageUrl(url)) return null;

  try {
    const parsed = new URL(url);
    const original = parsed.toString();
    parsed.pathname = parsed.pathname.replace(/\/p\d+x\d+\//i, "/p1080x1080/");
    parsed.searchParams.delete("stp");
    parsed.searchParams.delete("w");
    parsed.searchParams.delete("h");
    parsed.searchParams.set("stp", "dst-jpg_s1080x1080");
    const upgraded = parsed.toString();
    return upgraded === original ? null : upgraded;
  } catch {
    return null;
  }
}

function classifyHeroImageCandidate(candidate) {
  const reasons = [];
  const softReasons = [];
  const width = toPositiveNumber(candidate.width);
  const height = toPositiveNumber(candidate.height);
  const area = width && height ? width * height : null;
  const lowerUrl = String(candidate.url || "").toLowerCase();

  if (!candidate.url) {
    return { hardRejected: true, softRejected: false, hardReason: "missing_url", softReason: null, score: -1 };
  }

  if (HARD_REJECT_URL_PATTERNS.some((pattern) => pattern.test(lowerUrl))) {
    reasons.push("junk_url_pattern");
  }

  if (width && height) {
    if (Math.min(width, height) < HARD_MIN_SIDE || (area && area < HARD_MIN_AREA)) {
      reasons.push("too_tiny");
    }
    if (width === height && width <= 220) {
      reasons.push("tiny_square_avatar");
    }
  }

  const hardRejected = reasons.length > 0;
  if (!hardRejected) {
    if (!width || !height) {
      softReasons.push("missing_dimensions");
    } else if (width < SOFT_MIN_WIDTH || height < SOFT_MIN_HEIGHT) {
      softReasons.push("small_cover");
    }
  }

  const sourceBoost =
    candidate.source === "facebook_cover"
      ? 120
      : candidate.source === "og:image"
        ? 90
        : candidate.source === "og:image_alt"
          ? 80
          : candidate.source === "jsonld:image"
            ? 75
            : 60;
  const resolutionScore = width && height ? Math.min(300, Math.round((width * height) / 5000)) : 15;
  const ratioPenalty = width && height ? Math.abs(width / height - 1.78) * 20 : 10;
  const softPenalty = softReasons.length ? 80 : 0;
  const score = sourceBoost + resolutionScore - ratioPenalty - softPenalty;

  const softReason = softReasons.includes("small_cover")
    ? "soft_fallback_small_cover"
    : softReasons.includes("missing_dimensions")
      ? "soft_fallback_missing_dimensions"
      : null;

  return {
    hardRejected,
    softRejected: softReasons.length > 0,
    hardReason: reasons[0] ?? null,
    softReason,
    score,
  };
}

function selectHeroImageCandidate({ fbEvent = {}, ogMeta = {}, existing = {} }) {
  const candidates = collectHeroImageCandidates({ fbEvent, ogMeta, existing }).map((candidate) => {
    const upgradedUrl = getFacebookUpgradedUrl(candidate.url);
    const classification = classifyHeroImageCandidate(candidate);
    return { ...candidate, upgradedUrl, ...classification };
  });

  const nonRejected = candidates.filter((candidate) => !candidate.hardRejected && !candidate.softRejected);
  const softFallback = candidates.filter((candidate) => !candidate.hardRejected && candidate.softRejected);
  const byScoreDesc = (a, b) => b.score - a.score;

  const selected = [...nonRejected].sort(byScoreDesc)[0] ?? [...softFallback].sort(byScoreDesc)[0] ?? null;

  const selectedReason = nonRejected.length
    ? "best_non_rejected"
    : selected?.softReason ?? (candidates.length ? "rejected_all_candidates" : "no_candidates");

  return {
    selected,
    selectedReason,
    diagnostics: {
      candidates_total: candidates.length,
      candidates_non_rejected: nonRejected.length,
      candidates_soft_fallback: softFallback.length,
      selected_source: selected?.source ?? "none",
      selected_reason: selectedReason,
      selected_score: selected ? Number(selected.score.toFixed(2)) : null,
    },
  };
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

  const upgraded = getFacebookUpgradedUrl(original);
  const attempts = [upgraded, original].filter(Boolean);

  let lastReason = "unknown";
  for (const attemptUrl of attempts) {
    try {
      const { buffer, contentType, sourceUrl } = await fetchImageAsBuffer(attemptUrl, config);
      const { storagePath, publicUrl } = await uploadHeroImageToStorage({
        supabase,
        imageBuffer: buffer,
        contentType,
        sourceUrl,
        bucket: config.bucket,
      });

      logger.log(`[rehost] status=ok stored=${storagePath} public=${publicUrl} source=${attemptUrl === original ? "original" : "upgraded"}`);
      return publicUrl;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "unknown";
      logger.log(`[rehost] status=retry reason=${lastReason} source=${attemptUrl === original ? "original" : "upgraded"}`);
    }
  }

  logger.log(`[rehost] status=fail reason=${lastReason}`);
  return config.allowOriginalOnFailure ? original : null;
}

async function buildPendingFestivalPatch({ fbEvent = {}, ogMeta = {}, existing = {}, supabase, rehostOptions = {} }) {
  const description = extractDescription({ fbEvent, ogMeta });
  const dates = extractDates({ fbEvent, existing });
  const location = extractLocation({ fbEvent, existing });

  const heroSelection = selectHeroImageCandidate({ fbEvent, ogMeta, existing });
  const originalHeroImage = heroSelection.selected?.upgradedUrl || heroSelection.selected?.url || null;

  console.log(`[ingest] hero original=${originalHeroImage ?? ""}`);
  console.log(
    `[image] candidates=${heroSelection.diagnostics.candidates_total} non_rejected=${heroSelection.diagnostics.candidates_non_rejected} soft_fallback=${heroSelection.diagnostics.candidates_soft_fallback} selected_source=${heroSelection.diagnostics.selected_source} selected_reason=${heroSelection.diagnostics.selected_reason}`
  );
  const finalHeroImage = await rehostHeroImageIfNeeded({
    heroImageUrl: originalHeroImage,
    supabase,
    options: rehostOptions,
    logger: console,
  });
  console.log(`[ingest] hero final=${finalHeroImage ?? ""}`);

  const coordsLocked = existing.coords_override === true;
  const { latitude: _ingestFbLat, longitude: _ingestFbLng, ...locationWithoutCoords } = location;
  const payload = {
    title: typeof fbEvent.name === "string" ? fbEvent.name.trim() : existing.title ?? "",
    description,
    hero_image: finalHeroImage,
    ...dates,
    ...(coordsLocked
      ? { ...locationWithoutCoords, latitude: existing.latitude ?? null, longitude: existing.longitude ?? null }
      : location),
  };

  console.log(`[ingest] title="${payload.title}"`);
  console.log(`[ingest] start_date=${payload.start_date ?? ""}`);
  console.log(`[ingest] location="${payload.location_name ?? ""}"`);
  console.log(`[ingest] persisted hero=${payload.hero_image ?? ""}`);

  return payload;
}

module.exports = {
  buildPendingFestivalPatch,
  classifyHeroImageCandidate,
  collectHeroImageCandidates,
  extFromContentType,
  extractDates,
  extractDescription,
  extractLocation,
  fetchImageAsBuffer,
  getFacebookUpgradedUrl,
  hashBuffer,
  isFacebookImageUrl,
  normalizeISODate,
  rehostHeroImageIfNeeded,
  selectHeroImageCandidate,
  uploadHeroImageToStorage,
};
