"use client";

import FollowButton from "./FollowButton";

type Props = {
  organizerId: string;
  organizerName?: string;
  /** Profile follows list passes known state to skip the initial GET. */
  initialAuthenticated?: boolean;
  initialFollowing?: boolean;
};

export default function FollowOrganizerButton({
  organizerId,
  organizerName,
  initialAuthenticated,
  initialFollowing,
}: Props) {
  return (
    <FollowButton
      endpoint="/api/follow/organizer"
      paramKey="organizer_id"
      paramValue={organizerId}
      labelIdle={organizerName ? `Следвай ${organizerName}` : "Следвай организатора"}
      labelActive="Следваш"
      loginLabel="Влез, за да следваш"
      icon="star"
      pixelEvent="FollowOrganizer"
      initialAuthenticated={initialAuthenticated}
      initialFollowing={initialFollowing}
    />
  );
}
