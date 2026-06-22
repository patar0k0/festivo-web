import { buildFacebookPostSystemPrompt } from "./facebookPostSystemPrompt";
import { posterExtractionSchema, type PosterExtraction } from "./posterExtractionSchema";
import type { InlineImage } from "./posterImageToInline";

export type FacebookPostExtractor = (input: {
  text: string;
  image: InlineImage | null;
  categories?: string[];
}) => Promise<PosterExtraction>;

const USER_TEXT_PREFIX = 'Текст на Facebook поста (извлечи структурираните данни по схемата, само JSON):\n\n"""';
const USER_TEXT_SUFFIX = '"""';
const MAX_TEXT_LENGTH = 6000;

/**
 * Default extractor: Gemini text+optional-image extraction + Zod validation.
 * `gemini-provider` is dynamically imported so this module (and its test, which
 * injects a fake extractor) doesn't eagerly pull in its "server-only" guard.
 */
export const geminiFacebookPostExtractor: FacebookPostExtractor = async ({ text, image, categories }) => {
  const { geminiExtractJsonWithImages } = await import("../research/gemini-provider");
  const userText = `${USER_TEXT_PREFIX}${text.slice(0, MAX_TEXT_LENGTH)}${USER_TEXT_SUFFIX}`;

  const raw = await geminiExtractJsonWithImages<unknown>({
    systemInstruction: buildFacebookPostSystemPrompt(categories),
    userText,
    images: image ? [{ mimeType: image.mimeType, data: image.data }] : [],
  });

  const parsed = posterExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Facebook post extraction did not match schema: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }
  return parsed.data;
};

export async function extractFestivalFromFacebookPost(input: {
  text: string;
  image: InlineImage | null;
  categories?: string[];
  extractor?: FacebookPostExtractor;
}): Promise<PosterExtraction> {
  const run = input.extractor ?? geminiFacebookPostExtractor;
  return run(input);
}
