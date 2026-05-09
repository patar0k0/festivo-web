import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

type OnboardingCategorySuggestion = {
  slug: string;
  label_bg: string;
  icon: string;
};

type OnboardingCitySuggestion = {
  slug: string;
  name_bg: string;
};

type OnboardingOrganizerSuggestion = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  verified: boolean;
  city: string | null;
  followers_count: number;
  upcoming_festival_count: number;
  categories: string[];
  explanation: string;
};

export type OnboardingSuggestionsPayload = {
  categories: OnboardingCategorySuggestion[];
  cities: OnboardingCitySuggestion[];
  organizers: OnboardingOrganizerSuggestion[];
};

type BuilderInput = {
  supabase: SupabaseClient;
  user: User | null;
  selectedCategorySlugs: Set<string>;
  selectedCitySlugs: Set<string>;
};

type FestivalLiteRow = {
  id: string;
  category: string | null;
  city_slug: string | null;
  start_date: string | null;
  end_date: string | null;
  organizer_id: string | null;
  user_plan_festivals?: Array<{ count?: number }> | null;
};

type FestivalOrganizerLinkRow = {
  festival_id: string | null;
  organizer_id: string | null;
};

type OrganizerRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  verified: boolean | null;
  cities?: { name_bg?: string | null } | Array<{ name_bg?: string | null }> | null;
};

const ORGANIZER_LIMIT = 12;
const CITY_LIMIT = 12;
const CATEGORY_LIMIT = 12;
const UPCOMING_POOL_LIMIT = 300;

const CATEGORY_LABELS_BG: Record<string, { label: string; icon: string }> = {
  music: { label: "Музика", icon: "music" },
  folklore: { label: "Фолклор", icon: "traditional" },
  food: { label: "Храна и напитки", icon: "food" },
  crafts: { label: "Занаяти", icon: "crafts" },
  art: { label: "Изкуство", icon: "palette" },
  culture: { label: "Култура", icon: "culture" },
  family: { label: "За семейства", icon: "family" },
  dance: { label: "Танци", icon: "dance" },
  film: { label: "Кино", icon: "film" },
  theatre: { label: "Театър", icon: "theatre" },
  market: { label: "Базар", icon: "market" },
  sports: { label: "Спорт", icon: "sports" },
};

function normalizeSlugLike(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0400-\u04ff-]/g, "")
    .replace(/-+/g, "-");
}

function splitQueryList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((chunk) => normalizeSlugLike(chunk))
    .filter(Boolean);
}

function categoryMeta(rawCategory: string): { slug: string; label_bg: string; icon: string } {
  const slug = normalizeSlugLike(rawCategory);
  const known = CATEGORY_LABELS_BG[slug];
  if (known) {
    return { slug, label_bg: known.label, icon: known.icon };
  }
  return {
    slug,
    label_bg: rawCategory.trim(),
    icon: "festival",
  };
}

function toCount(rel: Array<{ count?: number }> | null | undefined): number {
  const count = rel?.[0]?.count;
  return typeof count === "number" ? count : 0;
}

function cityName(joined: OrganizerRow["cities"]): string | null {
  if (!joined) return null;
  const row = Array.isArray(joined) ? joined[0] : joined;
  const name = row?.name_bg;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function explanationForOrganizer(input: {
  city: string | null;
  hasCityOverlap: boolean;
  overlapCategory: string | null;
  upcomingFestivalCount: number;
}): string {
  if (input.hasCityOverlap && input.city) {
    return `Популярен в ${input.city}`;
  }
  if (input.overlapCategory) {
    const normalized = normalizeSlugLike(input.overlapCategory);
    if (normalized.includes("folklore") || normalized.includes("фолклор")) {
      return "Организира фолклорни фестивали";
    }
    return `Организира ${input.overlapCategory} фестивали`;
  }
  if (input.upcomingFestivalCount > 0) {
    return "Има предстоящи събития";
  }
  return "Препоръчан организатор";
}

async function loadUserSignals(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ followedOrganizerIds: Set<string>; followedCategorySlugs: Set<string>; followedCitySlugs: Set<string> }> {
  const [organizerRows, categoryRows, cityRows] = await Promise.all([
    supabase.from("user_followed_organizers").select("organizer_id").eq("user_id", userId).limit(200),
    supabase.from("user_followed_categories").select("category_slug").eq("user_id", userId).limit(200),
    supabase.from("user_followed_cities").select("city_slug").eq("user_id", userId).limit(200),
  ]);

  const followedOrganizerIds = new Set<string>();
  for (const row of organizerRows.data ?? []) {
    const id = typeof row.organizer_id === "string" ? row.organizer_id.trim() : "";
    if (id) followedOrganizerIds.add(id);
  }

  const followedCategorySlugs = new Set<string>();
  for (const row of categoryRows.data ?? []) {
    const slug = typeof row.category_slug === "string" ? normalizeSlugLike(row.category_slug) : "";
    if (slug) followedCategorySlugs.add(slug);
  }

  const followedCitySlugs = new Set<string>();
  for (const row of cityRows.data ?? []) {
    const slug = typeof row.city_slug === "string" ? normalizeSlugLike(row.city_slug) : "";
    if (slug) followedCitySlugs.add(slug);
  }

  return { followedOrganizerIds, followedCategorySlugs, followedCitySlugs };
}

export async function buildOnboardingSuggestions(input: BuilderInput): Promise<OnboardingSuggestionsPayload> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: festivalRows, error: festivalsError } = await input.supabase
    .from("festivals")
    .select("id,category,city_slug,start_date,end_date,organizer_id,user_plan_festivals(count)")
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .gte("end_date", todayIso)
    .order("start_date", { ascending: true })
    .limit(UPCOMING_POOL_LIMIT)
    .returns<FestivalLiteRow[]>();
  if (festivalsError) {
    throw new Error(festivalsError.message);
  }

  const upcomingFestivals = festivalRows ?? [];
  const festivalIds = upcomingFestivals.map((row) => row.id).filter(Boolean);

  const { data: festivalOrganizerLinks, error: linksError } = festivalIds.length
    ? await input.supabase
        .from("festival_organizers")
        .select("festival_id,organizer_id")
        .in("festival_id", festivalIds)
        .returns<FestivalOrganizerLinkRow[]>()
    : { data: [], error: null };
  if (linksError) {
    throw new Error(linksError.message);
  }

  const organizerIds = new Set<string>();
  for (const row of upcomingFestivals) {
    if (row.organizer_id) organizerIds.add(row.organizer_id);
  }
  for (const link of festivalOrganizerLinks ?? []) {
    if (typeof link.organizer_id === "string" && link.organizer_id.trim()) {
      organizerIds.add(link.organizer_id.trim());
    }
  }

  const organizerIdList = [...organizerIds];
  const { data: organizerRows, error: organizersError } = organizerIdList.length
    ? await input.supabase
        .from("organizers")
        .select("id,slug,name,logo_url,verified,cities:cities!organizers_city_id_fkey(name_bg)")
        .eq("is_active", true)
        .eq("verified", true)
        .in("id", organizerIdList)
        .returns<OrganizerRow[]>()
    : { data: [], error: null };
  if (organizersError) {
    throw new Error(organizersError.message);
  }

  const { data: followerRows, error: followerError } = organizerIdList.length
    ? await input.supabase
        .from("user_followed_organizers")
        .select("organizer_id")
        .in("organizer_id", organizerIdList)
    : { data: [], error: null };
  if (followerError) {
    throw new Error(followerError.message);
  }

  const userSignals =
    input.user?.id != null
      ? await loadUserSignals(input.supabase, input.user.id)
      : { followedOrganizerIds: new Set<string>(), followedCategorySlugs: new Set<string>(), followedCitySlugs: new Set<string>() };

  const preferredCategorySlugs = new Set<string>([...input.selectedCategorySlugs, ...userSignals.followedCategorySlugs]);
  const preferredCitySlugs = new Set<string>([...input.selectedCitySlugs, ...userSignals.followedCitySlugs]);

  const followersCountByOrganizer = new Map<string, number>();
  for (const row of followerRows ?? []) {
    const organizerId = typeof row.organizer_id === "string" ? row.organizer_id : "";
    if (!organizerId) continue;
    followersCountByOrganizer.set(organizerId, (followersCountByOrganizer.get(organizerId) ?? 0) + 1);
  }

  const linkedOrganizerIdsByFestival = new Map<string, Set<string>>();
  for (const link of festivalOrganizerLinks ?? []) {
    const festivalId = typeof link.festival_id === "string" ? link.festival_id : "";
    const organizerId = typeof link.organizer_id === "string" ? link.organizer_id : "";
    if (!festivalId || !organizerId) continue;
    if (!linkedOrganizerIdsByFestival.has(festivalId)) linkedOrganizerIdsByFestival.set(festivalId, new Set<string>());
    linkedOrganizerIdsByFestival.get(festivalId)!.add(organizerId);
  }

  const categoryScore = new Map<string, number>();
  const cityStats = new Map<string, { upcomingCount: number; trendingPoints: number }>();
  const organizerStats = new Map<
    string,
    {
      upcomingFestivalCount: number;
      categorySet: Set<string>;
      citySlugSet: Set<string>;
      trendingPoints: number;
      categoryOverlap: number;
      cityOverlap: number;
    }
  >();

  for (const festival of upcomingFestivals) {
    const saveCount = toCount(festival.user_plan_festivals);
    const citySlug = typeof festival.city_slug === "string" ? normalizeSlugLike(festival.city_slug) : "";
    const rawCategory = typeof festival.category === "string" ? festival.category.trim() : "";
    const categorySlug = rawCategory ? normalizeSlugLike(rawCategory) : "";

    if (rawCategory && categorySlug) {
      const boost = preferredCategorySlugs.has(categorySlug) ? 3 : 1;
      categoryScore.set(rawCategory, (categoryScore.get(rawCategory) ?? 0) + boost + saveCount);
    }

    if (citySlug) {
      const prevCity = cityStats.get(citySlug) ?? { upcomingCount: 0, trendingPoints: 0 };
      prevCity.upcomingCount += 1;
      prevCity.trendingPoints += saveCount;
      cityStats.set(citySlug, prevCity);
    }

    const organizersForFestival = new Set<string>();
    if (festival.organizer_id) organizersForFestival.add(festival.organizer_id);
    for (const linkedId of linkedOrganizerIdsByFestival.get(festival.id) ?? []) {
      organizersForFestival.add(linkedId);
    }

    for (const organizerId of organizersForFestival) {
      const prev = organizerStats.get(organizerId) ?? {
        upcomingFestivalCount: 0,
        categorySet: new Set<string>(),
        citySlugSet: new Set<string>(),
        trendingPoints: 0,
        categoryOverlap: 0,
        cityOverlap: 0,
      };
      prev.upcomingFestivalCount += 1;
      prev.trendingPoints += saveCount;
      if (rawCategory) prev.categorySet.add(rawCategory);
      if (categorySlug && preferredCategorySlugs.has(categorySlug)) prev.categoryOverlap += 1;
      if (citySlug) prev.citySlugSet.add(citySlug);
      if (citySlug && preferredCitySlugs.has(citySlug)) prev.cityOverlap += 1;
      organizerStats.set(organizerId, prev);
    }
  }

  const { data: cityNameRows, error: cityNameError } = cityStats.size
    ? await input.supabase
        .from("cities")
        .select("slug,name_bg")
        .in("slug", [...cityStats.keys()])
        .returns<Array<{ slug: string | null; name_bg: string | null }>>()
    : { data: [], error: null };
  if (cityNameError) {
    throw new Error(cityNameError.message);
  }
  const cityNameBySlug = new Map<string, string>();
  for (const row of cityNameRows ?? []) {
    const slug = typeof row.slug === "string" ? normalizeSlugLike(row.slug) : "";
    const name = typeof row.name_bg === "string" ? row.name_bg.trim() : "";
    if (slug && name) cityNameBySlug.set(slug, name);
  }

  const categories: OnboardingCategorySuggestion[] = [...categoryScore.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "bg");
    })
    .slice(0, CATEGORY_LIMIT)
    .map(([rawCategory]) => categoryMeta(rawCategory));

  const cities: OnboardingCitySuggestion[] = [...cityStats.entries()]
    .map(([slug, stats]) => ({
      slug,
      name_bg: cityNameBySlug.get(slug) ?? slug,
      score: stats.upcomingCount * 10 + stats.trendingPoints,
      upcomingCount: stats.upcomingCount,
      trendingPoints: stats.trendingPoints,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.upcomingCount !== a.upcomingCount) return b.upcomingCount - a.upcomingCount;
      if (b.trendingPoints !== a.trendingPoints) return b.trendingPoints - a.trendingPoints;
      return a.slug.localeCompare(b.slug, "bg");
    })
    .slice(0, CITY_LIMIT)
    .map((row) => ({ slug: row.slug, name_bg: row.name_bg }));

  const organizerById = new Map((organizerRows ?? []).map((row) => [row.id, row]));
  const organizers: OnboardingOrganizerSuggestion[] = [...organizerStats.entries()]
    .map(([organizerId, stats]) => {
      const organizer = organizerById.get(organizerId);
      if (!organizer) return null;
      if (!organizer.slug || !organizer.name) return null;

      const followerCount = followersCountByOrganizer.get(organizerId) ?? 0;
      const categoriesForOrganizer = [...stats.categorySet].sort((a, b) => a.localeCompare(b, "bg")).slice(0, 4);
      const hasCityOverlap = stats.cityOverlap > 0;
      const overlapCategory = categoriesForOrganizer.find((cat) => preferredCategorySlugs.has(normalizeSlugLike(cat))) ?? null;
      const organizerCity = cityName(organizer.cities);
      const explanation = explanationForOrganizer({
        city: organizerCity,
        hasCityOverlap,
        overlapCategory,
        upcomingFestivalCount: stats.upcomingFestivalCount,
      });

      let score = 0;
      score += stats.categoryOverlap * 10;
      score += stats.cityOverlap * 8;
      score += stats.upcomingFestivalCount * 6;
      score += Math.min(40, stats.trendingPoints);
      score += Math.min(30, followerCount);
      if (input.user && userSignals.followedOrganizerIds.has(organizerId)) score += 15;

      return {
        id: organizer.id,
        slug: organizer.slug,
        name: organizer.name,
        logo_url: organizer.logo_url ?? null,
        verified: Boolean(organizer.verified),
        city: organizerCity,
        followers_count: followerCount,
        upcoming_festival_count: stats.upcomingFestivalCount,
        categories: categoriesForOrganizer,
        explanation,
        score,
      };
    })
    .filter((row): row is OnboardingOrganizerSuggestion & { score: number } => row !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.upcoming_festival_count !== a.upcoming_festival_count) return b.upcoming_festival_count - a.upcoming_festival_count;
      if (b.followers_count !== a.followers_count) return b.followers_count - a.followers_count;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, ORGANIZER_LIMIT)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      logo_url: row.logo_url,
      verified: row.verified,
      city: row.city,
      followers_count: row.followers_count,
      upcoming_festival_count: row.upcoming_festival_count,
      categories: row.categories,
      explanation: row.explanation,
    }));

  return { categories, cities, organizers };
}

export function parseOnboardingPreferenceSlugs(url: URL): { categorySlugs: Set<string>; citySlugs: Set<string> } {
  const categorySlugs = new Set<string>();
  const citySlugs = new Set<string>();

  for (const value of splitQueryList(url.searchParams.get("categories"))) {
    categorySlugs.add(value);
  }
  for (const value of splitQueryList(url.searchParams.get("cities"))) {
    citySlugs.add(value);
  }

  return { categorySlugs, citySlugs };
}
