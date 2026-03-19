import { getCityBySlug } from "@/lib/festivals";
import { cityLabelFromSlug } from "@/lib/cities";

export async function resolveCityNameFromSlug(slug: string): Promise<string> {
  const match = await getCityBySlug(slug);
  if (match?.name) return match.name;
  return cityLabelFromSlug(slug);
}
