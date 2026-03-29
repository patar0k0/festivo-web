function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripYear(value: string): string {
  return value.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\s+/g, " ").trim();
}

function inferCityToken(query: string): string | null {
  const cityPatterns = [
    /\b(?:в|in)\s+([\p{Lu}][\p{L}\-]{2,40})\b/iu,
    /\b(?:гр\.?|city)\s+([\p{Lu}][\p{L}\-]{2,40})\b/iu,
  ];

  for (const pattern of cityPatterns) {
    const match = query.match(pattern);
    const city = match?.[1]?.trim();
    if (city) return city;
  }

  return null;
}

function pushUnique(target: string[], value: string) {
  const normalized = normalizeSpaces(value);
  if (!normalized) return;

  const key = normalized.toLocaleLowerCase("bg-BG");
  if (!target.some((item) => item.toLocaleLowerCase("bg-BG") === key)) {
    target.push(normalized);
  }
}

export function buildResearchQueries(query: string): string[] {
  const base = normalizeSpaces(query);
  if (!base) return [];

  const queries: string[] = [];
  const queryWithoutYear = stripYear(base);
  const city = inferCityToken(base);

  pushUnique(queries, base);

  if (!/\bfestival\b|\bфестивал\b/iu.test(base)) {
    pushUnique(queries, `${base} festival`);
    pushUnique(queries, `${base} фестивал`);
  }

  if (city) {
    pushUnique(queries, `${base} ${city}`);
  }

  if (queryWithoutYear) {
    pushUnique(queries, `${queryWithoutYear} official site`);
    pushUnique(queries, `${queryWithoutYear} официален сайт`);
  }

  return queries.slice(0, 6);
}

/** Multi-query variants for Gemini grounded search (фестивал / събор / year / locale). */
export function buildGeminiPipelineQueries(query: string): string[] {
  const base = normalizeSpaces(query);
  if (!base) return [];

  const queries: string[] = [];
  const yearsInQuery = base.match(/\b(20[2-3]\d)\b/g) ?? [];
  const currentY = new Date().getFullYear();
  const yearExtras = yearsInQuery.length ? yearsInQuery : [String(currentY), String(currentY + 1)];
  const stripped = stripYear(base);
  const city = inferCityToken(base);

  pushUnique(queries, base);
  pushUnique(queries, `${base} фестивал`);
  pushUnique(queries, `${base} събор`);
  pushUnique(queries, `${base} културно събитие`);
  pushUnique(queries, `${stripped} фестивал България`);
  pushUnique(queries, `${stripped} festival Bulgaria`);
  pushUnique(queries, `${stripped} официален сайт`);
  pushUnique(queries, `${stripped} програма дати`);
  pushUnique(queries, `${stripped} Facebook събитие`);

  if (city) {
    pushUnique(queries, `${stripped} ${city} фестивал`);
    pushUnique(queries, `${city} ${stripped} събор`);
  }

  for (const y of yearExtras) {
    pushUnique(queries, `${stripped} ${y}`.trim());
    pushUnique(queries, `${stripped} ${y} фестивал`.trim());
    pushUnique(queries, `${stripped} ${y} събор`.trim());
    pushUnique(queries, `${stripped} ${y} културно събитие`.trim());
  }

  return queries.slice(0, 14);
}
