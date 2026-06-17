import "server-only";
import sharp from "sharp";

// Posters are text-dense; keep enough resolution for OCR but bound payload size.
const TARGET_WIDTH = 1280;

export type InlineImage = { mimeType: string; data: string };

export async function posterBufferToInline(buffer: Buffer): Promise<InlineImage> {
  const jpeg = await sharp(buffer)
    .rotate()
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return { mimeType: "image/jpeg", data: jpeg.toString("base64") };
}
