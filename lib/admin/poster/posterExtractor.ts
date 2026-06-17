import "server-only";
import { geminiExtractJsonWithImages } from "@/lib/admin/research/gemini-provider";
import { buildPosterSystemPrompt } from "@/lib/admin/poster/posterSystemPrompt";
import { posterExtractionSchema, type PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";
import type { InlineImage } from "@/lib/admin/poster/posterImageToInline";

export type PosterExtractor = (input: {
  image: InlineImage;
  caption?: string;
  categories?: string[];
}) => Promise<PosterExtraction>;

const USER_TEXT_HINT =
  "Извлечи структурираните данни от този плакат по схемата. Само JSON. Ако подателят е добавил пояснение, ползвай го само като контекст, не като източник на факти:";

/** Default extractor: Gemini vision (reuses geminiExtractJsonWithImages) + Zod validation. */
export const geminiPosterExtractor: PosterExtractor = async ({ image, caption, categories }) => {
  const userText = caption && caption.trim() ? `${USER_TEXT_HINT}\n"${caption.trim()}"` : USER_TEXT_HINT;

  const raw = await geminiExtractJsonWithImages<unknown>({
    systemInstruction: buildPosterSystemPrompt(categories),
    userText,
    images: [{ mimeType: image.mimeType, data: image.data }],
  });

  // Zod with .catch() defaults is tolerant; a hard failure means the model
  // returned something unusable → surface it.
  const parsed = posterExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Poster extraction did not match schema: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }
  return parsed.data;
};

/** Swap point for an alternative provider (e.g. Claude) later. */
export async function extractFestivalFromPoster(input: {
  image: InlineImage;
  caption?: string;
  categories?: string[];
  extractor?: PosterExtractor;
}): Promise<PosterExtraction> {
  const run = input.extractor ?? geminiPosterExtractor;
  return run(input);
}
