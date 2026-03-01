import { MetadataRoute } from "next";
import { addMonths, format } from "date-fns";
import { getCities, getFestivalSlugs } from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";
import { slugify } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.FESTIVO_PUBLIC_MODE === "coming-soon") {
    return [
      {
        url: "https://festivo.bg/coming-soon",
        lastModified: new Date(),
      },
    ];
  }

  const baseUrl = getBaseUrl();
  const [slugs, cities] = await Promise.all([getFestivalSlugs(), getCities()]);

  const core = ["/", "/festivals", "/map", "/calendar"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }));

  const festivalUrls = slugs.map((slug) => ({
    url: `${baseUrl}/festival/${slug}`,
    lastModified: new Date(),
  }));

  const cityUrls = cities.map((city) => ({
    url: `${baseUrl}/cities/${encodeURIComponent(slugify(city))}`,
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
