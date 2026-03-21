/** Anchor id for the programme block on `/festivals/[slug]` (deep links from cards / map). */
export const FESTIVAL_PROGRAM_SECTION_ID = "festival-program";

export function festivalProgrammeHref(detailPath: string): string {
  const base = detailPath.split("#")[0];
  return `${base}#${FESTIVAL_PROGRAM_SECTION_ID}`;
}
