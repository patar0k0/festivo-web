import type { SmartResearchResult } from "@/lib/admin/research/smart-pipeline";
import type { PerplexityFestivalResearchResult } from "@/lib/research/perplexity";

export type AiResultWithGallery = PerplexityFestivalResearchResult & {
  gallery_image_urls: string[];
};

/**
 * Maps a SmartResearchResult into the shape buildResearchPendingRowFromRequest
 * expects under `ai_result`, mirroring the mapping
 * components/admin/SmartResearchPanel.tsx applies in `sendToPipeline` when an
 * admin sends a manually-run Smart Research result to the pipeline. There is
 * no human picking a hero image in this unattended script, so the first
 * image candidate is used as the hero when no explicit hero_image was
 * extracted, and the rest become gallery_image_urls.
 */
export function buildAiResultFromSmartResearch(smart: SmartResearchResult): AiResultWithGallery {
  const { fields, sources, confidence } = smart;
  const heroImage = fields.hero_image ?? fields.hero_image_candidates[0] ?? null;
  const galleryImageUrls = fields.hero_image_candidates.filter((url) => url !== heroImage);

  return {
    title: fields.title,
    description: fields.description,
    category: fields.category,
    start_date: fields.start_date,
    end_date: fields.end_date,
    city: fields.city,
    location_name: fields.location_name,
    address: fields.address,
    organizer_name: fields.organizer_name,
    organizer_names: fields.organizer_names,
    website_url: fields.website_url,
    facebook_url: fields.facebook_url,
    instagram_url: fields.instagram_url,
    ticket_url: fields.ticket_url,
    hero_image: heroImage,
    is_free: fields.is_free,
    program_draft: fields.program_draft,
    source_urls: sources.filter((source) => !source.is_ai_overview).map((source) => source.url),
    confidence,
    missing_fields: [],
    gallery_image_urls: galleryImageUrls,
  };
}
