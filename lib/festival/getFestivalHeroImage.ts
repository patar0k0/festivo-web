import type { Festival, FestivalMedia } from "@/lib/types";

type FestivalWithMedia = Festival & {
  festival_media?: Array<Partial<FestivalMedia> & { is_primary?: boolean | null }> | null;
};

function normalizeImageUrl(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isImageMedia(type?: string | null): boolean {
  if (!type) return true;
  return type.toLowerCase().includes("image");
}

export function getFestivalHeroImage(festival: FestivalWithMedia): string | null {
  const heroImage = normalizeImageUrl(festival.hero_image);
  if (heroImage) return heroImage;

  const imageUrl = normalizeImageUrl(festival.image_url);
  if (imageUrl) return imageUrl;

  const media = (festival.festival_media ?? []).filter(
    (item) => isImageMedia(item.type) && Boolean(normalizeImageUrl(item.url)),
  );

  const primaryImage = media.find((item) => item.is_primary)?.url;
  const normalizedPrimaryImage = normalizeImageUrl(primaryImage);
  if (normalizedPrimaryImage) return normalizedPrimaryImage;

  const firstMediaImage = normalizeImageUrl(media[0]?.url);
  if (firstMediaImage) return firstMediaImage;

  return null;
}
