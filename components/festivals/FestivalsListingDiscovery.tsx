"use client";

import FestivalsCompoundSearch from "@/components/festivals/FestivalsCompoundSearch";
import QuickChipsClient from "@/components/home/QuickChipsClient";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

type CityRow = { name: string; slug: string | null; filterValue: string };

export default function FestivalsListingDiscovery({
  chips,
  cityOptions,
  initialQuery,
  initialCity,
  initialFrom,
  initialTo,
}: {
  chips: Array<{ label: string; href: string }>;
  cityOptions: CityRow[];
  initialQuery: string;
  initialCity?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  return (
    <div className={cn(pub.panelHero, "relative overflow-hidden p-4 md:p-5")}>
      <div className="relative z-[1] space-y-3">
        <FestivalsCompoundSearch
          cities={cityOptions}
          initialQuery={initialQuery}
          initialCity={initialCity}
          initialFrom={initialFrom}
          initialTo={initialTo}
        />
        <div>
          <hr className="border-amber-900/20 my-1" />
          <QuickChipsClient chips={chips} />
        </div>
      </div>
    </div>
  );
}
