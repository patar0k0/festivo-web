import { Filters, Festival, PaginatedResult } from "@/lib/types";
import { getCityFestivals, getFestivals, getFestivalBySlug, getCities } from "@/lib/queries";
import { slugify } from "@/lib/utils";

type City = {
  name: string;
  slug: string;
};

export async function listFestivals(
  filters: Filters,
  page = 1,
  pageSize = 12
): Promise<PaginatedResult<Festival>> {
  return getFestivals(filters, page, pageSize);
}

export async function getFestivalDetailBySlug(slug: string): Promise<Festival | null> {
  return getFestivalBySlug(slug);
}

export async function listCities(): Promise<City[]> {
  const cities = await getCities();
  return cities.map((name) => ({ name, slug: slugify(name) }));
}

export async function getCityBySlug(slug: string): Promise<City | null> {
  const cities = await listCities();
  return cities.find((city) => city.slug === slug) ?? null;
}

export async function listFestivalsByCity(city: string, filters: Filters, page = 1, pageSize = 10) {
  return getCityFestivals(city, filters, page, pageSize);
}
