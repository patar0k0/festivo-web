export type RecommendationExplanationCode =
  | "because_follow"
  | "trending_near_you"
  | "starts_soon"
  | "popular_in_city"
  | "promoted_pick"
  | "recently_updated";

export type RecommendationExplanation = {
  code: RecommendationExplanationCode;
  label: string;
  label_bg: string;
  params?: Record<string, string>;
};

export function formatRecommendationExplanation(
  code: RecommendationExplanationCode,
  params?: Record<string, string>,
): RecommendationExplanation {
  switch (code) {
    case "because_follow":
      return {
        code,
        label: params?.name ? `Because you follow ${params.name}` : "Because you follow this organizer",
        label_bg: params?.name ? `Защото следвате ${params.name}` : "Защото следвате този организатор",
        params,
      };
    case "trending_near_you":
      return {
        code,
        label: "Trending near you",
        label_bg: "Трендиращо близо до вас",
        params,
      };
    case "starts_soon":
      return {
        code,
        label: "Starts soon",
        label_bg: "Започва скоро",
        params,
      };
    case "popular_in_city":
      return {
        code,
        label: params?.city ? `Popular in ${params.city}` : "Popular in your area",
        label_bg: params?.city ? `Популярно в ${params.city}` : "Популярно близо до вас",
        params,
      };
    case "promoted_pick":
      return {
        code,
        label: "Featured pick",
        label_bg: "Подбрано събитие",
        params,
      };
    case "recently_updated":
      return {
        code,
        label: "Recently updated",
        label_bg: "Наскоро обновено",
        params,
      };
    default: {
      const neverCode: never = code;
      return {
        code: neverCode,
        label: "Recommended for you",
        label_bg: "Препоръка за вас",
        params,
      };
    }
  }
}
