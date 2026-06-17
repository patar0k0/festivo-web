import type { PosterDateComponents } from "./posterExtractionSchema";

export function isoFromComponents(comp: PosterDateComponents | null, today: Date): string | null;
export function programToGeminiShape(
  program: { days: Array<{ day: number | null; month: number | null; title: string | null; items: unknown[] }> } | null,
  festivalYear: number,
): { days: Array<{ date: string; title: string | null; items: unknown[] }> } | null;
export function contactNote(contact: { phone: string | null; person: string | null } | null): string;
