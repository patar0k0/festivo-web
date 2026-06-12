import type { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import { compareFestivalsForListing } from "@/lib/festival/sorting";

/**
 * Дневна ротация на „органичната" опашка на началната страница.
 *
 * Продуктово правило: платените позиции (promoted ИЛИ VIP организатор) винаги стоят
 * най-отпред, в стабилния ред от `compareFestivalsForListing`. Всичко останало
 * („органичното") се разбърква детерминистично с seed от текущата дата — така всеки
 * ден редът е различен (свежест + по-справедлива експозиция), но през деня е
 * напълно стабилен за всички потребители.
 *
 * Защо детерминистично (а не `Math.random()`):
 *  - редът зависи само от деня → резултатът е кешируем (`unstable_cache` ключът вече
 *    включва `today`), нула SEO/кеш щета;
 *  - сървър и клиент дават еднакъв ред → няма hydration mismatch.
 *
 * Функциите тук са ЧИСТИ (без I/O) и изолирано-верифицируеми.
 */

/** Стабилен 32-битов seed от `YYYY-MM-DD` (FNV-1a). Същата дата → същия seed. */
export function dailyRotationSeed(dateYmd: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < dateYmd.length; i++) {
    hash ^= dateYmd.charCodeAt(i);
    // FNV prime умножение, държано в 32 бита.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Детерминистичен PRNG (mulberry32) — връща генератор на числа в [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates с seeded PRNG. Връща НОВ масив; входът не се мутира. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Платена позиция = promoted фестивал ИЛИ VIP организатор (закована най-отпред). */
function isFixedPosition(festival: Festival, now: Date): boolean {
  return hasActivePromotion(festival, now) || hasActiveVip(festival.organizer, now);
}

/**
 * Подрежда кандидатите за лента като: [платени — по стабилния ред] + [органични —
 * разбъркани с дневния seed]. Резултатът се подава на `buildHomeRails`, който прави
 * dedup + diversity + рязане до лимита на лентата.
 *
 * @param candidates кандидати за лентата (вече филтрирани по времеви прозорец)
 * @param seed дневен seed от {@link dailyRotationSeed}
 * @param now референтно „сега" за проверка на активна промоция/VIP (по подразбиране new Date())
 */
export function arrangeFestivalsWithDailyRotation(
  candidates: Festival[],
  seed: number,
  now: Date = new Date(),
): Festival[] {
  const fixed: Festival[] = [];
  const organic: Festival[] = [];
  for (const f of candidates) {
    if (isFixedPosition(f, now)) fixed.push(f);
    else organic.push(f);
  }
  fixed.sort(compareFestivalsForListing);
  return [...fixed, ...seededShuffle(organic, seed)];
}
