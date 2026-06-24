"use client";

import FollowButton from "./FollowButton";

type Props = {
  citySlug: string;
  cityName?: string;
  /** Profile follows list passes known state to skip the initial GET. */
  initialAuthenticated?: boolean;
  initialFollowing?: boolean;
};

export default function FollowCityButton({
  citySlug,
  cityName,
  initialAuthenticated,
  initialFollowing,
}: Props) {
  return (
    <FollowButton
      endpoint="/api/follow/city"
      paramKey="city_slug"
      paramValue={citySlug}
      labelIdle={cityName ? `Следвай ${cityName}` : "Следвай града"}
      labelActive="Следваш"
      loginLabel="Влез, за да следваш"
      icon="heart"
      pixelEvent="FollowCity"
      initialAuthenticated={initialAuthenticated}
      initialFollowing={initialFollowing}
    />
  );
}
