import { decodeHtmlEntities, extractDomain, normalizeUrl } from "@/lib/admin/research/source-extract";

export type ExtractedPageSignals = {
  url: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  hero_image: string | null;
  /** Non-empty when any factual field was parsed from this page. */
  had_data: boolean;
};

const BG_MONTHS: Record<string, number> = {
  януари: 1,
  февруари: 2,
  март: 3,
  април: 4,
  май: 5,
  юни: 6,
  юли: 7,
  август: 8,
  септември: 9,
  октомври: 10,
  ноември: 11,
  декември: 12,
};

function isoDateOnly(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function pickName(value: unknown): string | null {
  if (typeof value === "string") {
    const s = value.trim();
    return s.length > 0 ? s : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const n = pickName(item);
      if (n) return n;
    }
    return null;
  }
  if (value && typeof value === "object" && "name" in value) {
    return pickName((value as { name?: unknown }).name);
  }
  return null;
}

function parsePostalAddress(addr: unknown): { city: string | null; street: string | null } {
  if (!addr || typeof addr !== "object") return { city: null, street: null };
  const o = addr as Record<string, unknown>;
  const city = pickName(o.addressLocality) ?? pickName(o.addressRegion);
  const street = pickName(o.streetAddress);
  return { city, street };
}

function parseLocation(loc: unknown): { name: string | null; city: string | null; address: string | null } {
  if (!loc) return { name: null, city: null, address: null };
  if (typeof loc === "string") {
    const s = loc.trim();
    return { name: s || null, city: null, address: null };
  }
  if (typeof loc !== "object") return { name: null, city: null, address: null };
  const o = loc as Record<string, unknown>;
  const name = pickName(o.name);
  const addr = parsePostalAddress(o.address);
  const inner = o.location ? parseLocation(o.location) : { name: null, city: null, address: null };
  const city = addr.city ?? inner.city;
  const street = addr.street ?? inner.address;
  const address = street ?? (name && !city ? name : null);
  return {
    name: name ?? inner.name,
    city,
    address: address ?? inner.address,
  };
}

type JsonLdEventSlice = {
  name: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer: string | null;
  image: string | null;
};

function extractImageUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const u = normalizeUrl(value);
    return u;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const u = extractImageUrl(item);
      if (u) return u;
    }
    return null;
  }
  if (value && typeof value === "object" && "url" in value) {
    return extractImageUrl((value as { url?: unknown }).url);
  }
  return null;
}

function eventSliceFromObject(o: Record<string, unknown>): JsonLdEventSlice {
  const loc = parseLocation(o.location);
  const org = o.organizer;
  let organizer: string | null = null;
  if (org && typeof org === "object") {
    organizer = pickName((org as { name?: unknown }).name);
  } else {
    organizer = pickName(org);
  }

  return {
    name: pickName(o.name),
    description: pickName(o.description),
    start: isoDateOnly(pickName(o.startDate) ?? (typeof o.startDate === "string" ? o.startDate : null)),
    end: isoDateOnly(pickName(o.endDate) ?? (typeof o.endDate === "string" ? o.endDate : null)),
    city: loc.city,
    location_name: loc.name,
    address: loc.address,
    organizer,
    image: extractImageUrl(o.image),
  };
}

function isEventType(t: unknown): boolean {
  if (typeof t === "string") return /(^|[:/])Event$/i.test(t) || t === "Event" || t === "Festival";
  if (Array.isArray(t)) return t.some((x) => isEventType(x));
  return false;
}

function walkJsonLdForEvents(node: unknown, depth: number, out: JsonLdEventSlice[]): void {
  if (depth > 12 || node === null || node === undefined) return;

  if (Array.isArray(node)) {
    for (const item of node) walkJsonLdForEvents(item, depth + 1, out);
    return;
  }

  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;

  if (isEventType(o["@type"])) {
    out.push(eventSliceFromObject(o));
  }

  if (Array.isArray(o["@graph"])) {
    for (const item of o["@graph"]) walkJsonLdForEvents(item, depth + 1, out);
  }

  for (const key of Object.keys(o)) {
    if (key === "@context" || key === "@graph") continue;
    const v = o[key];
    if (v && typeof v === "object") {
      walkJsonLdForEvents(v, depth + 1, out);
    }
  }
}

function collectJsonLdBlocks(html: string): unknown[] {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out: unknown[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      /* ignore invalid JSON-LD */
    }
  }
  return out;
}

function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  if (m?.[1]) return decodeHtmlEntities(m[1]).trim() || null;
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i");
  const m2 = html.match(re2);
  if (m2?.[1]) return decodeHtmlEntities(m2[1]).trim() || null;
  return null;
}

function extractBgDatesFromText(text: string, defaultYear: number | null): string[] {
  const found = new Set<string>();
  const year = defaultYear ?? new Date().getUTCFullYear();

  const reMonthFirst = new RegExp(
    `\\b(\\d{1,2})\\s*(?:ми\\s+)?(${Object.keys(BG_MONTHS).join("|")})\\b`,
    "giu",
  );
  for (const m of text.matchAll(reMonthFirst)) {
    const day = Number.parseInt(m[1] ?? "", 10);
    const monKey = (m[2] ?? "").toLowerCase();
    const month = BG_MONTHS[monKey];
    if (!month || !Number.isFinite(day) || day < 1 || day > 31) continue;
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    found.add(ds);
  }

  for (const m of text.matchAll(/\b(\d{1,2})[.](\d{1,2})[.](20\d{2})\b/g)) {
    const d = Number.parseInt(m[1] ?? "", 10);
    const mo = Number.parseInt(m[2] ?? "", 10);
    const y = Number.parseInt(m[3] ?? "", 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      found.add(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }

  return [...found];
}

function mergeJsonLdSlices(slices: JsonLdEventSlice[]): JsonLdEventSlice | null {
  if (slices.length === 0) return null;
  const titles = slices.map((s) => s.name).filter((x): x is string => Boolean(x));
  const title = titles.sort((a, b) => b.length - a.length)[0] ?? null;

  const starts = slices.map((s) => s.start).filter((x): x is string => Boolean(x));
  const start = starts.length ? starts.sort()[0] : null;

  const ends = slices.map((s) => s.end).filter((x): x is string => Boolean(x));
  const end = ends.length ? ends.sort().reverse()[0] : null;

  const descs = slices.map((s) => s.description).filter((x): x is string => Boolean(x));
  const description = descs.sort((a, b) => b.length - a.length)[0] ?? null;

  const cities = slices.map((s) => s.city).filter((x): x is string => Boolean(x));
  const city = modeString(cities);

  const locNames = slices.map((s) => s.location_name).filter((x): x is string => Boolean(x));
  const location_name = locNames.sort((a, b) => b.length - a.length)[0] ?? null;

  const addresses = slices.map((s) => s.address).filter((x): x is string => Boolean(x));
  const address = addresses.sort((a, b) => b.length - a.length)[0] ?? null;

  const orgs = slices.map((s) => s.organizer).filter((x): x is string => Boolean(x));
  const organizer = orgs.sort((a, b) => b.length - a.length)[0] ?? null;

  const images = slices.map((s) => s.image).filter((x): x is string => Boolean(x));
  const image = images[0] ?? null;

  return {
    name: title,
    description,
    start,
    end,
    city,
    location_name,
    address,
    organizer,
    image,
  };
}

function modeString(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, { raw: string; n: number }>();
  for (const raw of values) {
    const k = raw.trim().toLowerCase();
    const cur = counts.get(k);
    if (cur) cur.n += 1;
    else counts.set(k, { raw: raw.trim(), n: 1 });
  }
  let best: { raw: string; n: number } | null = null;
  for (const { raw, n } of counts.values()) {
    if (!best || n > best.n || (n === best.n && raw.length > best.raw.length)) {
      best = { raw, n };
    }
  }
  return best?.raw ?? null;
}

export async function fetchHtmlForResearch(url: string): Promise<string | null> {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;

  const response = await fetch(normalizedUrl, {
    method: "GET",
    headers: {
      "User-Agent": "festivo-research-bot/3.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);

  if (!response || !response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;
  const html = await response.text().catch(() => "");
  return html.length > 0 ? html : null;
}

export function extractSignalsFromHtml(html: string, pageUrl: string, explicitYear: number | null): ExtractedPageSignals {
  const slices: JsonLdEventSlice[] = [];
  for (const block of collectJsonLdBlocks(html)) {
    walkJsonLdForEvents(block, 0, slices);
  }
  const mergedLd = mergeJsonLdSlices(slices);

  const ogTitle = metaContent(html, "og:title");
  const ogDesc = metaContent(html, "og:description");
  const ogImage = metaContent(html, "og:image");

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const docTitle = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : null;

  const title = mergedLd?.name ?? ogTitle ?? docTitle ?? null;

  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const plain = decodeHtmlEntities(withoutScripts.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80_000);

  const bgDates = extractBgDatesFromText(plain, explicitYear);
  let start_date = mergedLd?.start ?? null;
  let end_date = mergedLd?.end ?? null;

  if (!start_date && bgDates.length > 0) {
    start_date = bgDates.sort()[0] ?? null;
  }
  if (!end_date && bgDates.length > 0) {
    end_date = bgDates.sort().reverse()[0] ?? null;
  }

  if (explicitYear && start_date && !start_date.startsWith(String(explicitYear))) {
    start_date = null;
  }
  if (explicitYear && end_date && !end_date.startsWith(String(explicitYear))) {
    end_date = null;
  }

  if (start_date && end_date && end_date < start_date) {
    end_date = null;
  }
  if (start_date && !end_date) {
    end_date = start_date;
  }

  const description = mergedLd?.description ?? ogDesc ?? (plain.length > 0 ? plain.slice(0, 1200) : null);

  const city = mergedLd?.city ?? null;
  const location_name = mergedLd?.location_name ?? null;
  const address = mergedLd?.address ?? null;
  const organizer_name = mergedLd?.organizer ?? null;

  const hero = mergedLd?.image ?? (ogImage ? normalizeUrl(ogImage) : null);

  const had_data = Boolean(
    title ||
      description ||
      start_date ||
      city ||
      location_name ||
      address ||
      organizer_name ||
      hero,
  );

  return {
    url: pageUrl,
    title,
    description,
    start_date,
    end_date,
    city,
    location_name,
    address,
    organizer_name,
    hero_image: hero,
    had_data,
  };
}

export function rankDiscoveryUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const norm: string[] = [];
  for (const raw of urls) {
    const u = normalizeUrl(raw);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    norm.push(u);
  }

  const score = (url: string): number => {
    const h = extractDomain(url);
    const u = url.toLowerCase();
    if (u.includes("facebook.com/events") || u.includes("fb.me/")) return 0;
    if (u.includes("facebook.com/")) return 1;
    if (u.includes("eventibg") || u.includes("event.bg") || u.includes("eventsbg")) return 2;
    if (u.includes("programata") || u.includes("allevents")) return 3;
    if (BG_MEDIA_HOST_HINTS.some((x) => h.includes(x))) return 4;
    return 5;
  };

  return [...norm].sort((a, b) => score(a) - score(b)).slice(0, 5);
}

const BG_MEDIA_HOST_HINTS = ["bnr.bg", "bntnews.bg", "dnevnik.bg", "dariknews.bg", "marica.bg", "24chasa.bg"];

export function mergePageSignals(signals: ExtractedPageSignals[]): {
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  hero_image: string | null;
} {
  const withData = signals.filter((s) => s.had_data);
  const titles = withData.map((s) => s.title).filter((x): x is string => Boolean(x));
  const title = titles.length ? titles.sort((a, b) => b.length - a.length)[0]! : null;

  const starts = withData.map((s) => s.start_date).filter((x): x is string => Boolean(x));
  const start_date = starts.length ? starts.sort()[0]! : null;

  const ends = withData.map((s) => s.end_date).filter((x): x is string => Boolean(x));
  let end_date = ends.length ? ends.sort().reverse()[0]! : null;
  if (start_date && end_date && end_date < start_date) end_date = start_date;
  if (start_date && !end_date) end_date = start_date;

  const cities = withData.map((s) => s.city).filter((x): x is string => Boolean(x));
  const city = modeString(cities);

  const locs = withData.map((s) => s.location_name).filter((x): x is string => Boolean(x));
  const location_name = locs.length ? locs.sort((a, b) => b.length - a.length)[0]! : null;

  const addrs = withData.map((s) => s.address).filter((x): x is string => Boolean(x));
  const address = addrs.length ? addrs.sort((a, b) => b.length - a.length)[0]! : null;

  const orgs = withData.map((s) => s.organizer_name).filter((x): x is string => Boolean(x));
  const organizer_name = orgs.length ? orgs.sort((a, b) => b.length - a.length)[0]! : null;

  const heroes = withData.map((s) => s.hero_image).filter((x): x is string => Boolean(x));
  const hero_image = heroes[0] ?? null;

  const descParts = withData
    .map((s) => s.description?.trim())
    .filter((x): x is string => Boolean(x))
    .filter((x, i, arr) => arr.findIndex((y) => y === x) === i);
  const description =
    descParts.length === 0
      ? null
      : descParts.join("\n\n").length > 6000
        ? descParts.join("\n\n").slice(0, 6000)
        : descParts.join("\n\n");

  return {
    title,
    description,
    start_date,
    end_date,
    city,
    location_name,
    address,
    organizer_name,
    hero_image,
  };
}
