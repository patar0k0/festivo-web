import type { AccommodationProvider } from "@/lib/accommodation/provider";
import type { AccommodationOffer } from "@/lib/accommodation/types";

/**
 * Placeholder provider for local/staging checks. Disabled unless
 * `ACCOMMODATION_MOCK_PROVIDER=1`. Does not call external APIs.
 * Returns no offers by default so the public page never shows fake inventory.
 */
export const mockAccommodationProvider: AccommodationProvider = {
  id: "mock",
  async fetchOffers() {
    if (process.env.ACCOMMODATION_MOCK_SAMPLE === "1") {
      return [
        {
          provider: "mock",
          title: "Примерен обект (само при ACCOMMODATION_MOCK_SAMPLE)",
          url: "https://example.com",
          price_text: "от 120 лв.",
          distance_text: "~2 км",
        } satisfies AccommodationOffer,
      ];
    }
    return [];
  },
};
