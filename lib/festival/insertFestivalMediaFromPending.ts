import type { SupabaseClient } from "@supabase/supabase-js";

type PendingMediaSource = {
  gallery_image_urls?: unknown;
};

/**
 * Copies pending gallery image URLs into `festival_media` after publish (images only; video lives on `festivals.video_url`).
 */
export async function insertFestivalMediaFromPending(
  supabase: SupabaseClient,
  festivalId: string,
  pending: PendingMediaSource,
): Promise<void> {
  const galleryUrls: string[] = [];
  if (Array.isArray(pending.gallery_image_urls)) {
    for (const u of pending.gallery_image_urls) {
      if (typeof u === "string" && u.trim()) {
        galleryUrls.push(u.trim());
      }
    }
  }

  let sort = 0;
  const rows: Array<{
    festival_id: string;
    url: string;
    type: string;
    sort_order: number;
    is_hero: boolean;
  }> = [];

  for (const url of galleryUrls) {
    rows.push({
      festival_id: festivalId,
      url,
      type: "image",
      sort_order: sort++,
      is_hero: false,
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from("festival_media").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}
