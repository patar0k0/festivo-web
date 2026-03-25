/** Identifies which integration produced an offer (Booking.com, manual, etc.). */
export type AccommodationProviderId = string;

export type AccommodationOffer = {
  provider: AccommodationProviderId;
  title: string;
  url: string;
  image_url?: string | null;
  address?: string | null;
  distance_text?: string | null;
  price_text?: string | null;
  rating_text?: string | null;
  review_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type AccommodationFetchContext = {
  festivalId: string;
  slug: string;
  title: string;
  latitude?: number | null;
  longitude?: number | null;
  cityLabel?: string | null;
  address?: string | null;
};
