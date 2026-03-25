import type { AccommodationFetchContext, AccommodationOffer } from "@/lib/accommodation/types";

/**
 * Pluggable accommodation source (Booking.com affiliate, future APIs, etc.).
 * Implementations must not throw; return [] on failure or when disabled.
 */
export type AccommodationProvider = {
  id: string;
  fetchOffers: (ctx: AccommodationFetchContext) => Promise<AccommodationOffer[]>;
};
