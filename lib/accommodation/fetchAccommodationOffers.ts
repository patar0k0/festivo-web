import type { Festival } from "@/lib/types";
import { bookingAccommodationProvider } from "@/lib/accommodation/providers/booking";
import { mockAccommodationProvider } from "@/lib/accommodation/providers/mock";
import type { AccommodationProvider } from "@/lib/accommodation/provider";
import type { AccommodationFetchContext, AccommodationOffer } from "@/lib/accommodation/types";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";

function resolveProviders(): AccommodationProvider[] {
  const list: AccommodationProvider[] = [];
  if (process.env.BOOKING_ACCOMMODATION_ENABLED === "1") {
    list.push(bookingAccommodationProvider);
  }
  if (process.env.ACCOMMODATION_MOCK_PROVIDER === "1") {
    list.push(mockAccommodationProvider);
  }
  return list;
}

function hasLocationForSearch(festival: Festival): boolean {
  const lat = festival.latitude ?? festival.lat;
  const lng = festival.longitude ?? festival.lng;
  return typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);
}

function toContext(festival: Festival): AccommodationFetchContext {
  return {
    festivalId: String(festival.id),
    slug: festival.slug,
    title: festival.title,
    latitude: festival.latitude ?? festival.lat ?? null,
    longitude: festival.longitude ?? festival.lng ?? null,
    cityLabel: festivalCityLabel(festival, "") || null,
    address: festival.address?.trim() || null,
  };
}

/**
 * Server-only aggregation point for accommodation offers. Add Booking.com or other
 * providers by registering them in `resolveProviders()` (or env-driven list).
 */
export async function fetchAccommodationOffersForFestival(festival: Festival): Promise<AccommodationOffer[]> {
  const providers = resolveProviders();
  if (!providers.length) {
    return [];
  }

  if (!hasLocationForSearch(festival)) {
    return [];
  }

  const ctx = toContext(festival);
  const batches = await Promise.all(
    providers.map(async (p) => {
      try {
        return await p.fetchOffers(ctx);
      } catch {
        return [];
      }
    }),
  );

  const merged: AccommodationOffer[] = [];
  const seenUrl = new Set<string>();
  for (const offers of batches) {
    for (const o of offers) {
      const key = o.url.trim();
      if (!key || seenUrl.has(key)) continue;
      seenUrl.add(key);
      merged.push(o);
    }
  }
  return merged;
}
