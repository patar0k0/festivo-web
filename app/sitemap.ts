import { MetadataRoute } from "next";
import { addMonths, format } from "date-fns";
import { cityHref } from "@/lib/cities";
import { getCityLinks, getFestivalSlugs } from "@/lib/queries";
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
  const [slugs, cities] = await Promise.all([getFestivalSlugs(), getCityLinks()]);

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

  const months = Array.from({ length: 12 }).map((_, index) =>
    format(addMonths(new Date(), index), "yyyy-MM")
  );

  const monthUrls = months.map((month) => ({
    url: `${baseUrl}/calendar/${month}`,
    lastModified: new Date(),
  }));

  return [...core, ...festivalUrls, ...cityUrls, ...monthUrls];
}
