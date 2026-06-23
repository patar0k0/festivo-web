const FESTIVAL_KEYWORDS = [
  "фестивал",
  "фест",
  "събор",
  "панаир",
  "карнавал",
  "надпяване",
  "надсвирване",
  "надиграване",
  "концерт",
  "празник",
];

export function matchesFestivalKeyword(title: string): boolean {
  const lower = title.toLowerCase();
  return FESTIVAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}
