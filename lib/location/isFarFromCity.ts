/** Rough degree distance; ~0.2° is on the order of ~20 km in Bulgaria. */
export function isFarFromCity(lat: number, lng: number, cityLat: number, cityLng: number) {
  const dx = lat - cityLat;
  const dy = lng - cityLng;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist > 0.2;
}
