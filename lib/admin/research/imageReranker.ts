import "server-only";
import sharp from "sharp";
import { geminiExtractJsonWithImages } from "@/lib/admin/research/gemini-provider";

/**
 * AI image reranker for the Smart Research pipeline.
 *
 * The candidate pool is assembled by deterministic, *positional* heuristics, so
 * the first candidate (which becomes the default hero) is frequently a logo,
 * map, banner or an unrelated/other-festival photo. This module downloads the
 * candidates, downscales them with sharp, and asks a Gemini vision model to
 * score each one for how well it represents the given festival — then reorders
 * the pool so the best real cover is first and junk sinks to the bottom.
 *
 * Best-effort: any failure (download, sharp, model) falls back to the original
 * order so image discovery never regresses below the pre-rerank behaviour.
 */

// Bound cost/latency: never rerank more than this many candidates.
const MAX_RERANK = 6;
const DOWNSCALE_WIDTH = 512;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(h) ||
    /^(?:fc|fd|fe80:)/i.test(h)
  );
}

type DownloadedImage = { url: string; mimeType: string; data: string };

/** Downloads + downscales one candidate to a small JPEG. Returns null on failure. */
async function fetchAndDownscale(url: string): Promise<DownloadedImage | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (isBlockedHost(parsed.hostname)) return null;

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
        Referer: "",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_DOWNLOAD_BYTES) return null;

    const jpeg = await sharp(buf)
      .rotate()
      .resize({ width: DOWNSCALE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    return { url, mimeType: "image/jpeg", data: jpeg.toString("base64") };
  } catch {
    return null;
  }
}

type RankEntry = { index: number; score: number; is_relevant: boolean; kind?: string };

export type ImageRerankResult = {
  /** Candidate URLs reordered best-first. Always a permutation of the input. */
  ordered: string[];
  notes: string[];
};

export async function rerankImageCandidates(params: {
  candidates: string[];
  title: string;
  city: string | null;
}): Promise<ImageRerankResult> {
  const { candidates, title, city } = params;
  if (candidates.length <= 1) return { ordered: candidates, notes: [] };

  const pool = candidates.slice(0, MAX_RERANK);
  const rest = candidates.slice(MAX_RERANK);

  // Download + downscale in parallel; keep alignment to pool indices.
  const downloaded = await Promise.all(pool.map((u) => fetchAndDownscale(u)));
  const usable: Array<{ poolIndex: number; img: DownloadedImage }> = [];
  downloaded.forEach((img, i) => {
    if (img) usable.push({ poolIndex: i, img });
  });

  if (usable.length < 2) {
    return { ordered: candidates, notes: ["Vision reranker: недостатъчно заредени снимки — запазен оригиналният ред."] };
  }

  const locationLine = city ? `в ${city}` : "в България";
  const systemInstruction = [
    "Ти си асистент за подбор на корица (hero image) на български фестивал.",
    "Получаваш номерирани изображения-кандидати. Оцени всяко доколко добре представя СЪБИТИЕТО като атрактивна корица.",
    "Високо: реална снимка/афиш на фестивала (тълпа, сцена, изпълнители, плакат на изданието).",
    "Ниско / не е релевантно: лого, икона, карта, скрийншот, банер на сайт, стокова снимка, лице на едно лице (хедшот), несвързано събитие.",
    "Връщай само валиден JSON.",
  ].join(" ");

  const userText = [
    `Фестивал: "${title}" ${locationLine}.`,
    `Кандидати: ${usable.length} изображения, номерирани от 0 до ${usable.length - 1} в реда на подаване.`,
    'Върни JSON: {"ranking":[{"index":0,"score":0-100,"is_relevant":true|false,"kind":"снимка|афиш|лого|карта|друго"}]}',
    "score = колко добра е като корица. Подреди по подходящост не е нужно — само оцени всяко.",
  ].join("\n");

  let ranking: RankEntry[] = [];
  try {
    const parsed = await geminiExtractJsonWithImages<{ ranking?: RankEntry[] }>({
      systemInstruction,
      userText,
      images: usable.map((u) => ({ mimeType: u.img.mimeType, data: u.img.data })),
    });
    ranking = Array.isArray(parsed?.ranking) ? parsed.ranking : [];
  } catch (e) {
    return {
      ordered: candidates,
      notes: [`Vision reranker неуспешен (${e instanceof Error ? e.message : "грешка"}) — запазен оригиналният ред.`],
    };
  }

  if (ranking.length === 0) {
    return { ordered: candidates, notes: ["Vision reranker: моделът не върна оценки — запазен оригиналният ред."] };
  }

  // Map model "index" (0..usable.length-1) back to candidate URLs.
  const scoreByUrl = new Map<string, { score: number; relevant: boolean; kind?: string }>();
  for (const entry of ranking) {
    const u = usable[entry.index];
    if (!u) continue;
    const url = pool[u.poolIndex]!;
    const score = Number.isFinite(entry.score) ? Math.max(0, Math.min(100, entry.score)) : 0;
    scoreByUrl.set(url, { score, relevant: entry.is_relevant !== false, kind: entry.kind });
  }

  // Reorder the reranked pool: relevant first, then by score desc. URLs without a
  // score (download failed / model skipped) keep their relative order at the end
  // of the pool but before the never-considered `rest`.
  const scored = pool.filter((u) => scoreByUrl.has(u));
  const unscored = pool.filter((u) => !scoreByUrl.has(u));
  scored.sort((a, b) => {
    const sa = scoreByUrl.get(a)!;
    const sb = scoreByUrl.get(b)!;
    if (sa.relevant !== sb.relevant) return sa.relevant ? -1 : 1;
    return sb.score - sa.score;
  });

  const ordered = [...scored, ...unscored, ...rest];

  const notes: string[] = [];
  const top = scored[0] ? scoreByUrl.get(scored[0]) : undefined;
  if (top) {
    notes.push(`Vision: избрана корица score ${top.score}${top.kind ? ` (${top.kind})` : ""}.`);
  }
  const junk = scored.filter((u) => !scoreByUrl.get(u)!.relevant).length;
  if (junk > 0) notes.push(`Vision: ${junk} нерелевантни снимки (лого/карта/др.) преместени надолу.`);

  return { ordered, notes };
}
