/**
 * Approximate WGS84 centers for Bulgarian settlements (`cities.slug` / `festivals.city_slug`).
 * Used only when festival rows have no stored lat/lng — markers are approximate.
 */
const CENTROIDS: Record<string, readonly [number, number]> = {
  sofia: [42.6977, 23.3219],
  plovdiv: [42.1354, 24.7453],
  varna: [43.2141, 27.9147],
  burgas: [42.5048, 27.4626],
  ruse: [43.8486, 25.9544],
  "stara-zagora": [42.4258, 25.6342],
  pleven: [43.417, 24.6067],
  sliven: [42.6858, 26.329],
  dobrich: [43.5722, 27.8273],
  shumen: [43.2703, 26.9229],
  pernik: [42.6055, 23.0475],
  haskovo: [41.934, 25.5565],
  yambol: [42.4842, 26.5031],
  pazardzhik: [42.1928, 24.3336],
  blagoevgrad: [42.0209, 23.0943],
  "veliko-tarnovo": [43.0812, 25.629],
  vidin: [43.9876, 22.8824],
  montana: [43.4085, 23.2257],
  gabrovo: [42.8742, 25.3187],
  asenovgrad: [42.0087, 24.8783],
  kazanlak: [42.6194, 25.393],
  kardzhali: [41.64, 25.377],
  kyustendil: [42.2839, 22.7541],
  lovech: [43.142, 24.7138],
  silistra: [44.1172, 27.2606],
  smolyan: [41.5748, 24.7108],
  targovishte: [43.2462, 26.5722],
  dupnitsa: [42.2658, 23.1175],
  "gotse-delchev": [41.5656, 23.7375],
  petrich: [41.3981, 23.2067],
  sandanski: [41.5644, 23.2799],
  samokov: [42.3375, 23.5528],
  sevlievo: [43.0183, 25.1042],
  velingrad: [42.028, 23.9915],
  aytos: [42.7, 27.25],
  nesebar: [42.6588, 27.7366],
  pomorie: [42.5613, 27.6439],
  balchik: [43.4179, 28.1653],
  razgrad: [43.5333, 26.5167],
  dimitrovgrad: [42.05, 25.6333],
  "gorna-oryahovitsa": [43.1333, 25.7],
  svishtov: [43.6167, 25.35],
  lom: [43.8167, 23.2333],
  nikopol: [43.7, 24.8833],
  svilengrad: [41.7667, 26.2],
  harmanli: [41.9333, 25.9],
  popovo: [43.35, 26.2333],
  pirdop: [42.7, 24.1833],
  "cherven-bryag": [43.2667, 24.0833],
  mezdra: [43.15, 23.7167],
  berkovitsa: [43.2333, 23.1167],
  vratsa: [43.21, 23.5625],
  karlovo: [42.6333, 24.8],
  troyan: [42.8833, 24.7167],
  tryavna: [42.8667, 25.5],
  etropole: [42.8333, 24],
  botevgrad: [42.9, 23.7833],
  devin: [41.75, 24.4],
  chepelare: [41.7167, 24.6833],
  bansko: [41.8333, 23.4833],
  razlog: [41.8833, 23.4667],

  // --- Extended: villages and smaller towns that appear as festival venues ---
  // Ruse region
  basarbovo: [43.974, 26.015],
  nikolovo: [43.812, 25.986],
  sandrovo: [43.883, 25.967],
  // Pleven region
  grivitsa: [43.368, 24.678],
  mladen: [43.440, 24.583],
  slavyanovo: [43.402, 24.882],
  trudovets: [42.938, 23.817],
  // Troyan / Balkan mountains
  "cherni-osam": [42.830, 24.638],
  // Varna / Black Sea north
  devnya: [43.221, 27.566],
  // Montana / Vidin region
  "dolno-ozirovo": [43.167, 23.387],
  grancharovo: [43.645, 27.484],
  // Yambol region
  elhovo: [42.166, 26.569],
  // Plovdiv region
  hisarya: [42.500, 24.700],
  tsaratsovo: [42.091, 24.802],
  // Gabrovo / VT region
  tsarevets: [43.018, 25.687],
  // Kazanlak region
  kran: [42.565, 25.330],
  // Kyustendil / Sofia region
  kraynitsi: [42.168, 22.712],
  // Black Sea south
  kiten: [42.220, 27.782],
  kozichino: [42.648, 27.726],
  // Rila mountains resort
  "k-k-malyovitsa": [42.178, 23.617],
  // Shumen region
  vetrintsi: [43.280, 26.870],
  "zaychino-oreshe": [43.261, 26.885],
  // Kardzhali / Rhodopes
  pelevun: [41.725, 25.438],
  // Smolyan region
  "polkovnik-serafimovo": [41.622, 24.873],
  smilyan: [41.575, 24.738],
  // Zlatograd
  zlatograd: [41.383, 25.100],
  // Stara Zagora region
  obedinenie: [42.383, 25.508],
  // Plovdiv region (Parvomay)
  parvomay: [42.101, 25.217],
};

/** Tiny deterministic offset so multiple festivals in one settlement separate on the map. */
export function deterministicSettlementJitter(seed: string): { dLat: number; dLng: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 0xffff_ffff;
  const v = (Math.imul(h, 2_246_822_519) >>> 0) / 0xffff_ffff;
  const scale = 0.045;
  return { dLat: (u - 0.5) * scale, dLng: (v - 0.5) * scale };
}

export function getBulgariaSettlementCentroid(slug: string): { lat: number; lng: number } | null {
  const key = slug.trim().toLowerCase();
  const pair = CENTROIDS[key];
  if (!pair) return null;
  return { lat: pair[0], lng: pair[1] };
}
