"use client";

import PlanFestivalBookmark from "@/components/plan/PlanFestivalBookmark";

type Props = {
  festivalId: string;
  festival?: { start_date?: string | null; end_date?: string | null } | null;
  className?: string;
};

export default function FestivalCardSaveOverlay({ festivalId, festival, className }: Props) {
  return (
    <div
      className={className}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <PlanFestivalBookmark
        festivalId={festivalId}
        festival={festival}
        showProgrammeLink={false}
        showReminder={false}
        variant="icon"
      />
    </div>
  );
}
