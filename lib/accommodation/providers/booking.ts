import type { AccommodationProvider } from "@/lib/accommodation/provider";

/**
 * Placeholder for future Booking.com (or affiliate) integration.
 * Returns no offers until real API mapping is implemented.
 * Enable registration via `BOOKING_ACCOMMODATION_ENABLED=1` in `fetchAccommodationOffers` when ready.
 */
export const bookingAccommodationProvider: AccommodationProvider = {
  id: "booking",
  async fetchOffers() {
    return [];
  },
};
