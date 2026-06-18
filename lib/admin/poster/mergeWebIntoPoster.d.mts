import type { PosterExtraction } from "./posterExtractionSchema.js";
import type { GeminiRawExtraction } from "../research/gemini-extract.js";

export function mergeWebIntoPoster(poster: PosterExtraction, web: GeminiRawExtraction): PosterExtraction;
