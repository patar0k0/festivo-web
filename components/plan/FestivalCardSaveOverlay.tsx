"use client";

import PlanFestivalBookmark from "@/components/plan/PlanFestivalBookmark";

type Props = {
  festivalId: string;
  className?: string;
};

export default function FestivalCardSaveOverlay({ festivalId, className }: Props) {
  return (
    <div
      className={className}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <PlanFestivalBookmark
        festivalId={festivalId}
        showProgrammeLink={false}
        showReminder={false}
        variant="icon"
      />
    </div>
  );
}
