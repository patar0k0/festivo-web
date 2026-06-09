import type { Festival } from "@/lib/types";

/**
 * Pure logic за неприпокриващи се ленти на началната страница.
 *
 * Проблемът, който решава: „Предстоящи", „Този уикенд" и „Този месец" преди това
 * дърпаха от вложени времеви прозорци, всички сортирани еднакво (start_date ASC) и
 * взимаха първите 6 → визуално идентични списъци.
 *
 * Решение: waterfall дедупликация по приоритет (current → weekend → upcoming).
 * Всеки `festival.id` се „изразходва" от първата лента, в която попадне, и не се
 * повтаря по-надолу. Плюс меко diversity, за да не са всички 6 от една категория
 * (каталогът е ~54% фолклорни фестивали).
 *
 * Функцията е ЧИСТА (без I/O, без random) — детерминистична за фиксиран вход, така
 * остава съвместима с `unstable_cache` и е изолирано-верифицируема.
 */

export type RailInput = {
  /** Текущи (тече сега). Вече сортирани и ограничени от извикващия. */
  current: Festival[];
  /** Кандидати, пресичащи уикенда. Вече сортирани. */
  weekend: Festival[];
  /** Кандидати, предстоящи от днес нататък. Вече сортирани. */
  upcoming: Festival[];
};

export type RailOutput = {
  current: Festival[];
  weekend: Festival[];
  upcoming: Festival[];
};

export type BuildHomeRailsOptions = {
  /** Колко карти да показва всяка хронологична лента. По подразбиране 6. */
  perRail?: number;
  /** Меко: предпочитан макс. брой от една категория на лента. По подразбиране 2. */
  maxPerCategory?: number;
};

const DEFAULT_PER_RAIL = 6;
const DEFAULT_MAX_PER_CATEGORY = 2;
const NO_CATEGORY = "__none__";

function festivalKey(f: Festival): string {
  return String(f.id);
}

function categoryKey(f: Festival): string {
  const c = f.category?.trim().toLocaleLowerCase("bg-BG");
  return c ? c : NO_CATEGORY;
}

/**
 * Избира до `limit` фестивала от `candidates`:
 *  - пропуска вече изразходвани id-та (в `seen`);
 *  - меко diversity: предпочита макс. `maxPerCategory` от една категория, но ако
 *    лентата не се напълни — допълва от прескочените (по оригинален ред).
 * Мутира `seen` с избраните id-та. Запазва относителния ред на входа.
 * Фестивали без категория (`NO_CATEGORY`) не се ограничават от diversity.
 */
function pickRail(
  candidates: Festival[],
  seen: Set<string>,
  limit: number,
  maxPerCategory: number,
): Festival[] {
  if (limit <= 0) return [];
  const chosen: Festival[] = [];
  const deferred: Festival[] = [];
  const perCategory = new Map<string, number>();

  // Първи проход: уважавай diversity.
  for (const f of candidates) {
    if (chosen.length >= limit) break;
    const key = festivalKey(f);
    if (seen.has(key)) continue;
    const cat = categoryKey(f);
    const count = perCategory.get(cat) ?? 0;
    if (cat !== NO_CATEGORY && count >= maxPerCategory) {
      deferred.push(f);
      continue;
    }
    chosen.push(f);
    seen.add(key);
    perCategory.set(cat, count + 1);
  }

  // Втори проход (меко правило): допълни от прескочените, ако има място.
  for (const f of deferred) {
    if (chosen.length >= limit) break;
    const key = festivalKey(f);
    if (seen.has(key)) continue;
    chosen.push(f);
    seen.add(key);
  }

  return chosen;
}

/**
 * Прилага waterfall дедупликация + diversity върху трите ленти.
 *
 * Приоритет: `current` → `weekend` → `upcoming`.
 * - `current`: изразходва ВСИЧКИ подадени id-та (за да не се появят отново като
 *   „уикенд"/„предстоящи"), без diversity — текущите са малко и спешни.
 * - `weekend` / `upcoming`: до `perRail` всяка, с меко diversity, без id-та, които
 *   вече са показани по-горе.
 */
export function buildHomeRails(input: RailInput, opts: BuildHomeRailsOptions = {}): RailOutput {
  const perRail = opts.perRail ?? DEFAULT_PER_RAIL;
  const maxPerCategory = opts.maxPerCategory ?? DEFAULT_MAX_PER_CATEGORY;
  const seen = new Set<string>();

  // current: изразходвай ВСИЧКИ подадени id-та (за да не цъфтят като „уикенд"/
  // „предстоящи"), но покажи до perRail (CurrentFestivalsSection реже до 3).
  for (const f of input.current) seen.add(festivalKey(f));
  const current = input.current.slice(0, perRail);

  const weekend = pickRail(input.weekend, seen, perRail, maxPerCategory);
  const upcoming = pickRail(input.upcoming, seen, perRail, maxPerCategory);

  return { current, weekend, upcoming };
}
