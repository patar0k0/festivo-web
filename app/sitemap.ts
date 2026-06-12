import { MetadataRoute } from "next";
import { cityHref } from "@/lib/cities";
import { getCityLinks, getFestivalSlugs, getOrganizerSlugs } from "@/lib/queries";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { getBaseUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.FESTIVO_PUBLIC_MODE === "coming-soon") {
    return [
      {
        url: `${getBaseUrl().replace(/\/$/, "")}/`,
        lastModified: new Date(),
      },
    ];
  }

  const baseUrl = getBaseUrl();
  const [slugs, cities, organizerSlugs, categorySlugs] = await Promise.all([
    getFestivalSlugs(),
    getCityLinks(),
    getOrganizerSlugs(),
    listPublicFestivalCategorySlugs(),
  ]);

  const core = ["/", "/festivals", "/map", "/calendar"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }));

  const festivalUrls = slugs.map((slug) => ({
    url: `${baseUrl}/festivals/${slug}`,
    lastModified: new Date(),
  }));

  const cityUrls = cities.map((city) => ({
    url: `${baseUrl}${cityHref(city.slug)}`,
    lastModified: new Date(),
  }));

  const organizerUrls = organizerSlugs.map((slug) => ({
    url: `${baseUrl}/organizers/${encodeURIComponent(slug)}`,
    lastModified: new Date(),
  }));

  const categoryUrls = categorySlugs.map((slug) => ({
    url: `${baseUrl}/categories/${encodeURIComponent(slug)}`,
    lastModified: new Date(),
  }));

  return [...core, ...festivalUrls, ...cityUrls, ...organizerUrls, ...categoryUrls];
}
